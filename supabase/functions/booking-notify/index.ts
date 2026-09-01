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
  type Locale,
  type WebhookPayload,
} from "./lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")?.trim() ?? "";
const SITE_URL = (Deno.env.get("NEXT_PUBLIC_SITE_URL")?.trim() || "http://localhost:3000").replace(/\/+$/, "");


Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const record = payload?.record;
  if (!record || typeof record.id !== "string" || typeof record.user_id !== "string" || typeof record.type !== "string") {
    return json({ error: "Payload does not carry a notifications record" }, 400);
  }
  if (payload.type && payload.type !== "INSERT") {
    // The webhook is registered for INSERT only; anything else is an upstream
    // misconfiguration, and re-stamping a row we did not create would lie.
    return json({ ok: true, status: "ignored", reason: "not_an_insert" }, 200);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
