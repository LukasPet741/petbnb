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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")?.trim() ?? "";
const SITE_URL = (Deno.env.get("NEXT_PUBLIC_SITE_URL")?.trim() || "http://localhost:3000").replace(/\/+$/, "");

// Edge Functions run in UTC. The product is Lithuanian, so booking times are
// printed in Vilnius local time -- the same wall clock the recipient saw in the
// app when the booking was made.
const TIME_ZONE = "Europe/Vilnius";
const MAX_EMAIL_ERROR = 500;

type Locale = "en" | "lt";
type ServiceType = "walking" | "boarding" | "daycare" | "grooming";
type EmailStatus = "sent" | "skipped" | "failed";

/** Notification types that warrant an email. `message_received` deliberately does not. */
const EMAILED_TYPES = [
  "booking_requested",
  "booking_accepted",
  "booking_declined",
  "booking_cancelled",
  "booking_completed",
] as const;
type EmailedType = (typeof EMAILED_TYPES)[number];

interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string | null;
  booking_id: string | null;
  type: string;
  created_at: string;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: NotificationRecord | null;
  old_record?: NotificationRecord | null;
}

interface BookingRow {
  service: ServiceType | null;
  start_at: string | null;
  end_at: string | null;
  // PostgREST returns an object for a to-one embed; some client versions type it
  // as an array. Both shapes are normalised at the call site.
  pet: { name: string | null } | { name: string | null }[] | null;
}

const INTL_LOCALES: Record<Locale, string> = { en: "en-GB", lt: "lt-LT" };

const SERVICE_LABELS: Record<Locale, Record<ServiceType, string>> = {
  en: { walking: "Dog walking", boarding: "Boarding", daycare: "Daycare", grooming: "Grooming" },
  lt: {
    walking: "Šunų vedžiojimas",
    boarding: "Apgyvendinimas",
    daycare: "Dienos priežiūra",
    grooming: "Kirpimas",
  },
};

interface Copy {
  greeting: (firstName: string | null) => string;
  subject: Record<EmailedType, (actor: string) => string>;
  line: Record<EmailedType, (actor: string, pet: string) => string>;
  followUp: Partial<Record<EmailedType, string>>;
  labels: { service: string; start: string; end: string };
  cta: string;
  linkFallback: string;
  footer: string;
  unknownActor: string;
  fallbackPet: string;
}

const COPY: Record<Locale, Copy> = {
  en: {
    greeting: (firstName) => (firstName ? `Hi ${firstName},` : "Hi,"),
    subject: {
      booking_requested: (actor) => `New booking request from ${actor}`,
      booking_accepted: (actor) => `${actor} confirmed your booking`,
      booking_declined: (actor) => `${actor} declined your request`,
      booking_cancelled: (actor) => `${actor} cancelled the booking`,
      booking_completed: (actor) => `${actor} marked the booking as completed`,
    },
    line: {
      booking_requested: (actor, pet) => `${actor} sent a booking request for ${pet}.`,
      booking_accepted: (actor, pet) => `${actor} confirmed your booking for ${pet}.`,
      booking_declined: (actor, pet) => `${actor} declined your request for ${pet}.`,
      booking_cancelled: (actor, pet) => `${actor} cancelled the booking for ${pet}.`,
      booking_completed: (actor, pet) => `${actor} marked the booking for ${pet} as completed.`,
    },
    followUp: {
      booking_requested: "Open the conversation to accept or decline it.",
    },
    labels: { service: "Service", start: "Starts", end: "Ends" },
    cta: "Open the conversation",
    linkFallback: "If the button doesn't work, paste this link into your browser:",
    footer: "You're getting this because you're one of the two people on this booking.",
    unknownActor: "Someone",
    fallbackPet: "your pet",
  },
  lt: {
    // Lithuanian greetings take the vocative case ("Sveiki, Jonai"), which a
    // stored full_name cannot be inflected into reliably, so the LT greeting
    // stays nameless rather than printing a wrong case.
    greeting: () => "Sveiki,",
    subject: {
      booking_requested: (actor) => `Nauja užsakymo užklausa nuo ${actor}`,
      booking_accepted: (actor) => `${actor} patvirtino jūsų užsakymą`,
      booking_declined: (actor) => `${actor} atmetė jūsų užklausą`,
      booking_cancelled: (actor) => `${actor} atšaukė užsakymą`,
      booking_completed: (actor) => `${actor} pažymėjo užsakymą kaip įvykdytą`,
    },
    line: {
      booking_requested: (actor, pet) => `${actor} pateikė užsakymo užklausą augintiniui ${pet}.`,
      booking_accepted: (actor, pet) => `${actor} patvirtino jūsų užsakymą augintiniui ${pet}.`,
      booking_declined: (actor, pet) => `${actor} atmetė jūsų užklausą augintiniui ${pet}.`,
      booking_cancelled: (actor, pet) => `${actor} atšaukė užsakymą augintiniui ${pet}.`,
      booking_completed: (actor, pet) => `${actor} pažymėjo užsakymą augintiniui ${pet} kaip įvykdytą.`,
    },
    followUp: {
      booking_requested: "Atidarykite pokalbį, kad užklausą patvirtintumėte arba atmestumėte.",
    },
    labels: { service: "Paslauga", start: "Pradžia", end: "Pabaiga" },
    cta: "Atidaryti pokalbį",
    linkFallback: "Jei mygtukas neveikia, nukopijuokite šią nuorodą į naršyklę:",
    footer: "Šį laišką gavote, nes esate vienas iš dviejų šio užsakymo dalyvių.",
    unknownActor: "Kitas naudotojas",
    fallbackPet: "jūsų augintinis",
  },
};

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

interface EmailContext {
  locale: Locale;
  type: EmailedType;
  actorName: string;
  petName: string;
  recipientFirstName: string | null;
  service: ServiceType | null;
  startAt: string | null;
  endAt: string | null;
  url: string;
}

function renderEmail(ctx: EmailContext): { subject: string; html: string; text: string } {
  const copy = COPY[ctx.locale];
  const subject = copy.subject[ctx.type](ctx.actorName);
  const greeting = copy.greeting(ctx.recipientFirstName);
  const line = copy.line[ctx.type](ctx.actorName, ctx.petName);
  const followUp = copy.followUp[ctx.type] ?? "";

  const details: Array<[string, string]> = [];
  if (ctx.service && SERVICE_LABELS[ctx.locale][ctx.service]) {
    details.push([copy.labels.service, SERVICE_LABELS[ctx.locale][ctx.service]]);
  }
  const start = formatMoment(ctx.startAt, ctx.locale);
  if (start) details.push([copy.labels.start, start]);
  const end = formatMoment(ctx.endAt, ctx.locale);
  if (end) details.push([copy.labels.end, end]);

  return {
    subject,
    html: renderHtml(ctx, copy, { subject, greeting, line, followUp, details }),
    text: renderText(ctx, copy, { greeting, line, followUp, details }),
  };
}

interface RenderParts {
  subject?: string;
  greeting: string;
  line: string;
  followUp: string;
  details: Array<[string, string]>;
}

function renderHtml(ctx: EmailContext, copy: Copy, parts: RenderParts): string {
  const rows = parts.details
    .map(
      ([label, value]) => `
                  <tr>
                    <td style="padding:5px 0;font-size:13px;line-height:1.4;color:#56635c;">${escapeHtml(label)}</td>
                    <td align="right" style="padding:5px 0;font-size:13px;line-height:1.4;font-weight:600;color:#131a17;">${escapeHtml(value)}</td>
                  </tr>`
    )
    .join("");

  const detailsBlock = rows
    ? `
            <tr>
              <td style="padding:20px 28px 0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef3ef;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";

  const followUpBlock = parts.followUp
    ? `
                <p style="margin:10px 0 0 0;font-size:15px;line-height:1.55;color:#56635c;">${escapeHtml(parts.followUp)}</p>`
    : "";

  const href = escapeHtml(ctx.url);

  return `<!doctype html>
<html lang="${ctx.locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(parts.subject ?? "")}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f4;color:#131a17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(parts.line)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f4;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e8e5;border-radius:16px;">
            <tr>
              <td style="padding:26px 28px 0 28px;">
                <div style="font-size:14px;font-weight:700;letter-spacing:-0.01em;color:#1f5c47;">PetBnB</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0 28px;">
                <p style="margin:0;font-size:15px;line-height:1.5;color:#56635c;">${escapeHtml(parts.greeting)}</p>
                <p style="margin:8px 0 0 0;font-size:18px;line-height:1.45;font-weight:600;color:#131a17;">${escapeHtml(parts.line)}</p>${followUpBlock}
              </td>
            </tr>${detailsBlock}
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <a href="${href}" style="display:inline-block;background:#1f5c47;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;line-height:1;padding:14px 20px;border-radius:12px;">${escapeHtml(copy.cta)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0 28px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#56635c;">${escapeHtml(copy.linkFallback)}<br />
                  <a href="${href}" style="color:#1f5c47;">${href}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 26px 28px;">
                <p style="margin:0;padding-top:16px;border-top:1px solid #e4e8e5;font-size:12px;line-height:1.5;color:#56635c;">${escapeHtml(copy.footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(ctx: EmailContext, copy: Copy, parts: RenderParts): string {
  const lines = [parts.greeting, "", parts.line];
  if (parts.followUp) lines.push("", parts.followUp);
  if (parts.details.length) {
    lines.push("");
    for (const [label, value] of parts.details) lines.push(`${label}: ${value}`);
  }
  lines.push("", `${copy.cta}: ${ctx.url}`, "", copy.footer);
  return lines.join("\n");
}

/**
 * Addresses we refuse to hand to Resend. The project's 40 seeded fixture
 * accounts all use @petbnb.test, and .test is an RFC 2606 reserved TLD
 * guaranteed never to resolve -- every one of those sends would hard-bounce,
 * and bounce rate is exactly what destroys a Resend sender reputation (and with
 * it delivery to real users). The rest of the list is the same reserved set:
 * the documentation domains, localhost, .invalid and .local.
 */
const UNDELIVERABLE_DOMAINS = ["petbnb.test", "localhost", "example.com", "example.org", "example.net"];
const UNDELIVERABLE_TLDS = [".test", ".invalid", ".localhost", ".local", ".example"];

function isDeliverable(email: string): boolean {
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return false;
  const domain = domainOf(email);
  if (UNDELIVERABLE_DOMAINS.includes(domain)) return false;
  if (UNDELIVERABLE_TLDS.some((tld) => domain.endsWith(tld))) return false;
  // Subdomains of the reserved domains (mail.example.com) are just as dead.
  if (UNDELIVERABLE_DOMAINS.some((reserved) => domain.endsWith(`.${reserved}`))) return false;
  return domain.includes(".");
}

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

function isEmailedType(type: string): type is EmailedType {
  return (EMAILED_TYPES as readonly string[]).includes(type);
}

function formatMoment(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

function firstName(fullName: string | null): string | null {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

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
