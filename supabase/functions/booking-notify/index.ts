// Transactional email for booking events.
//
// A Supabase Database Webhook fires this function on every INSERT into
// public.notifications. The row already exists by the time we run, so the job
// is narrow: decide whether that notification deserves an email, send it, and
// stamp the outcome back onto the row (email_status / email_error).
//
// Anything already recorded on the row answers 200 -- a hard send failure
// included. A non-2xx makes Supabase retry the webhook, and a permanently
// undeliverable address would then retry forever. Only a malformed request or a
// database we cannot reach earns a 4xx/5xx.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";
import {
  COPY,
  MAX_EMAIL_ERROR,
  domainOf,
  firstName,
  isDeliverable,
  isEmailedType,
  renderEmail,
  truncate,
  type BookingRow,
  type EmailStatus,
  type NotificationRecord,
  type Locale,
  type WebhookPayload,
} from "./lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")?.trim() ?? "";
const SITE_URL = (Deno.env.get("NEXT_PUBLIC_SITE_URL")?.trim() || "http://localhost:3000").replace(/\/+$/, "");
// Optional and inert until it is set on both sides -- see the check below.
const WEBHOOK_SECRET = Deno.env.get("BOOKING_NOTIFY_SECRET")?.trim() ?? "";


Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // verify_jwt only proves the caller holds *a* project key, and the anon key
  // ships in every browser bundle -- so a valid JWT does not say this request
  // came from the database webhook. When a shared secret is configured, require
  // it; the trigger sends it as a header.
  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const claimed = payload?.record;
  if (!claimed || typeof claimed.id !== "string") {
    return json({ error: "Payload does not carry a notifications record" }, 400);
  }
  if (payload.type && payload.type !== "INSERT") {
    // The webhook is registered for INSERT only; anything else is an upstream
    // misconfiguration, and re-stamping a row we did not create would lie.
    return json({ ok: true, status: "ignored", reason: "not_an_insert" }, 200);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Nothing in the payload is trusted past the row id. The body arrives over the
  // public internet from anyone holding the anon key, and its fields decide who
  // gets mailed: taking user_id at face value made this an open "send PetBnB
  // email to any account" endpoint. Re-read the row with the service role
  // instead -- it is the row the trigger fired on, and it cannot be forged.
  const { data: row, error: rowError } = await supabase
    .from("notifications")
    .select("id, user_id, actor_id, booking_id, type, created_at, email_status")
    .eq("id", claimed.id)
    .maybeSingle();
  if (rowError) {
    // Unreachable database: nothing has been sent, so a webhook retry is safe.
    return json({ error: `Could not load notification: ${rowError.message}` }, 500);
  }
  if (!row) {
    // A row id that does not exist is a deleted row or a forged payload. Either
    // way there is nothing to send, and a non-2xx would only earn retries.
    return json({ ok: true, status: "ignored", reason: "no_such_notification" }, 200);
  }
  // 'pending' is the column's default -- the state every row is inserted in. Anything
  // else means this notification has already been decided once, and without this check
  // replaying one captured payload re-sends the same mail as often as the caller likes.
  if (row.email_status && row.email_status !== "pending") {
    return json({ ok: true, status: "ignored", reason: `already_${row.email_status}` }, 200);
  }

  const record: NotificationRecord = row;

  // Chat messages stay in-app on purpose: one email per chat line is spam in a
  // busy thread and would exhaust the free Resend tier in a day.
  if (record.type === "message_received") {
    return await skip(supabase, record.id, "message_received");
  }
  if (!isEmailedType(record.type)) {
    return await skip(supabase, record.id, `unhandled_type:${record.type}`);
  }
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return await skip(supabase, record.id, "resend_not_configured");
  }
  if (!record.booking_id) {
    return await skip(supabase, record.id, "no_booking");
  }

  // profiles has no email column -- auth.users is the only place an address
  // lives, and only the service role can read it.
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(record.user_id);
  if (authError) {
    console.error(`booking-notify: recipient lookup failed for notification ${record.id}: ${authError.message}`);
  }
  const email = authUser?.user?.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return await skip(supabase, record.id, "no_recipient_email");
  }
  if (!isDeliverable(email)) {
    return await skip(supabase, record.id, `undeliverable_domain:${domainOf(email)}`);
  }

  const [bookingRes, recipientRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("service, start_at, end_at, pet:pets ( name )")
      .eq("id", record.booking_id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, locale").eq("id", record.user_id).maybeSingle(),
  ]);

  // A query error here means the database is unreachable rather than the data
  // being absent. Nothing has been sent yet, so a webhook retry is safe.
  const dbError = bookingRes.error ?? recipientRes.error;
  if (dbError) {
    return json({ error: `Could not load booking context: ${dbError.message}` }, 500);
  }

  const locale: Locale = recipientRes.data?.locale === "lt" ? "lt" : "en";
  const copy = COPY[locale];

  let actorName = copy.unknownActor;
  if (record.actor_id) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", record.actor_id)
      .maybeSingle();
    actorName = actor?.full_name?.trim() || copy.unknownActor;
  }

  const booking = (bookingRes.data ?? null) as BookingRow | null;
  const petRow = Array.isArray(booking?.pet) ? booking?.pet[0] : booking?.pet;

  const { subject, html, text } = renderEmail({
    locale,
    type: record.type,
    actorName,
    petName: petRow?.name?.trim() || copy.fallbackPet,
    recipientFirstName: firstName(recipientRes.data?.full_name ?? null),
    service: booking?.service ?? null,
    startAt: booking?.start_at ?? null,
    endAt: booking?.end_at ?? null,
    url: `${SITE_URL}/messages/${record.booking_id}`,
  });

  let failure: string | null = null;
  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [email],
      subject,
      html,
      text,
    });
    if (error) {
      failure = [error.name, error.message].filter(Boolean).join(": ") || "Unknown Resend error";
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }

  const status: EmailStatus = failure ? "failed" : "sent";
  const stampError = await stamp(supabase, record.id, status, failure ? truncate(failure, MAX_EMAIL_ERROR) : null);
  if (stampError) {
    // The mail has already left; a non-2xx here would replay the whole webhook
    // and send it a second time. Accept the stale row and log instead.
    console.error(`booking-notify: could not stamp notification ${record.id}: ${stampError.message}`);
  }

  // Domain only -- a full address does not belong in the function logs.
  console.log(`booking-notify: ${record.type} -> @${domainOf(email)} [${locale}] ${status}`);
  return json({ ok: true, status }, 200);
});


async function stamp(
  supabase: SupabaseClient,
  id: string,
  status: EmailStatus,
  emailError: string | null
) {
  const { error } = await supabase
    .from("notifications")
    .update({ email_status: status, email_error: emailError })
    .eq("id", id);
  return error;
}

async function skip(supabase: SupabaseClient, id: string, reason: string): Promise<Response> {
  const error = await stamp(supabase, id, "skipped", null);
  if (error) {
    // Nothing was sent, so letting the webhook retry is harmless and gives the
    // row another chance to be marked.
    return json({ error: `Could not mark notification as skipped: ${error.message}` }, 500);
  }
  console.log(`booking-notify: skipped notification ${id} (${reason})`);
  return json({ ok: true, status: "skipped", reason }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
