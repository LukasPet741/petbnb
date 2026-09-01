// Pure helpers for the booking-notify Edge Function.
//
// Split out of index.ts so they can be unit-tested: index.ts calls Deno.serve
// at module scope and imports npm: specifiers, so importing it from a test
// would start a server. Nothing in this file touches Deno, the network, or
// the database -- it is all string, date and template logic.

// Edge Functions run in UTC. The product is Lithuanian, so booking times are
// printed in Vilnius local time -- the same wall clock the recipient saw in the
// app when the booking was made.
export const TIME_ZONE = "Europe/Vilnius";
export const MAX_EMAIL_ERROR = 500;

export type Locale = "en" | "lt";
export type ServiceType = "walking" | "boarding" | "daycare" | "grooming";
export type EmailStatus = "sent" | "skipped" | "failed";

/** Notification types that warrant an email. `message_received` deliberately does not. */
export const EMAILED_TYPES = [
  "booking_requested",
  "booking_accepted",
  "booking_declined",
  "booking_cancelled",
  "booking_completed",
] as const;
export type EmailedType = (typeof EMAILED_TYPES)[number];

export interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string | null;
  booking_id: string | null;
  type: string;
  created_at: string;
}

export interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: NotificationRecord | null;
  old_record?: NotificationRecord | null;
}

export interface BookingRow {
  service: ServiceType | null;
  start_at: string | null;
  end_at: string | null;
  // PostgREST returns an object for a to-one embed; some client versions type it
  // as an array. Both shapes are normalised at the call site.
  pet: { name: string | null } | { name: string | null }[] | null;
}

export const INTL_LOCALES: Record<Locale, string> = { en: "en-GB", lt: "lt-LT" };

export const SERVICE_LABELS: Record<Locale, Record<ServiceType, string>> = {
  en: { walking: "Dog walking", boarding: "Boarding", daycare: "Daycare", grooming: "Grooming" },
  lt: {
    walking: "Šunų vedžiojimas",
    boarding: "Apgyvendinimas",
    daycare: "Dienos priežiūra",
    grooming: "Kirpimas",
  },
};

export interface Copy {
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

export const COPY: Record<Locale, Copy> = {
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

export interface EmailContext {
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

export function renderEmail(ctx: EmailContext): { subject: string; html: string; text: string } {
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

export interface RenderParts {
  subject?: string;
  greeting: string;
  line: string;
  followUp: string;
  details: Array<[string, string]>;
}

export function renderHtml(ctx: EmailContext, copy: Copy, parts: RenderParts): string {
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

export function renderText(ctx: EmailContext, copy: Copy, parts: RenderParts): string {
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
export const UNDELIVERABLE_DOMAINS = ["petbnb.test", "localhost", "example.com", "example.org", "example.net"];
export const UNDELIVERABLE_TLDS = [".test", ".invalid", ".localhost", ".local", ".example"];

export function isDeliverable(email: string): boolean {
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return false;
  const domain = domainOf(email);
  if (UNDELIVERABLE_DOMAINS.includes(domain)) return false;
  if (UNDELIVERABLE_TLDS.some((tld) => domain.endsWith(tld))) return false;
  // Subdomains of the reserved domains (mail.example.com) are just as dead.
  if (UNDELIVERABLE_DOMAINS.some((reserved) => domain.endsWith(`.${reserved}`))) return false;
  return domain.includes(".");
}

export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export function isEmailedType(type: string): type is EmailedType {
  return (EMAILED_TYPES as readonly string[]).includes(type);
}

export function formatMoment(iso: string | null, locale: Locale): string {
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

export function firstName(fullName: string | null): string | null {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}