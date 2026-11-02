// Pure parts of the business admin tool (admin.mjs): reading the command line and laying out
// what the database answers. admin.mjs does the talking to Supabase.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const USAGE = `npm run business [command]

  claims                      claims waiting for a decision (the default)
  approve <claim id>          the claimant becomes the place's owner
  reject <claim id> <reason>  the claimant reads the reason on My business
  promotions                  Stripe subscriptions for Promoted placement
  outreach                    CSV of unclaimed businesses with their claim links

Runs against the database in .env.local, with its service role key.`;

/** argv after the script name → what to do. */
export function parseCommand(args) {
  const [command = "claims", id, ...rest] = args;
  if (command === "claims" || command === "promotions" || command === "outreach") return { kind: command };
  if (command === "approve" || command === "reject") {
    if (!id || !UUID.test(id)) return { kind: "error", message: `${command} needs a claim id (a uuid, from \`npm run business claims\`).` };
    if (command === "approve") return { kind: "approve", claimId: id.toLowerCase() };
    const reason = rest.join(" ").trim();
    if (!reason) return { kind: "error", message: "reject needs a reason: the claimant reads it on My business." };
    return { kind: "reject", claimId: id.toLowerCase(), reason };
  }
  return { kind: "error", message: `Unknown command "${command}".\n\n${USAGE}` };
}

const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

/** Pending claims, oldest first, each with what a decision needs. */
export function formatClaims(claims) {
  if (claims.length === 0) return "No claims waiting.";
  return claims
    .map((c) =>
      [
        `${c.placeName}  ·  ${c.role}  ·  ${day(c.createdAt)}`,
        `  from     ${c.email ?? "(no email)"}`,
        c.message ? `  message  ${c.message}` : null,
        `  id       ${c.id}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

const PAYING = new Set(["active", "trialing", "past_due"]);

/** Every subscription, with the count that is paying now. */
export function formatPromotions(promotions) {
  if (promotions.length === 0) return "No promotions yet.";
  const rows = promotions.map((p) => `${PAYING.has(p.status) ? "●" : "○"} ${p.placeName}  ·  ${p.status}  ·  since ${day(p.since)}  ·  ${p.subscriptionId}`);
  const paying = promotions.filter((p) => PAYING.has(p.status)).length;
  return `${rows.join("\n")}\n\n${paying} paying`;
}

/** A CSV cell: quoted when it must be, and never read as a formula by a spreadsheet. */
function cell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Unclaimed places, one row each, with the link that opens its claim form (see claimPath). */
export function outreachCsv(places, origin) {
  const header = "name,city,categories,website,claim_link";
  const rows = places.map((p) =>
    [p.name, p.city, p.categories.join(" "), p.website, `${origin}/partners?p=${encodeURIComponent(p.slug)}&claim=1`].map(cell).join(","),
  );
  return [header, ...rows].join("\n");
}
