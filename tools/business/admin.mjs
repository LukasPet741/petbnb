#!/usr/bin/env node
// Run PetBnB's business side from the terminal, on Lukas's machine:
//
//   npm run business                    claims waiting for a decision
//   npm run business approve <id>       the claimant becomes the place's owner
//   npm run business reject <id> <why>  the claimant reads why on My business
//   npm run business promotions         Stripe subscriptions for Promoted placement
//   npm run business outreach > out.csv unclaimed businesses with their claim links
//
// It uses the service role key in .env.local, so it writes to whichever database that file points
// at (production, on Lukas's machine). Nothing here is deployed. Needs migrations
// 20261103110000 (approve/reject) and 20261103100000 (promotions).
import { createClient } from "@supabase/supabase-js";
import { formatClaims, formatPromotions, outreachCsv, parseCommand, USAGE } from "./lib.mjs";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
const command = parseCommand(process.argv.slice(2));
if (command.kind === "error") {
  console.error(command.message);
  process.exit(2);
}

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("No .env.local here. Run this from the petbnb folder (SETUP.md §3).");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(".env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const missing = (error) => error && ["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code);
const fail = (error, migration) => {
  console.error(missing(error) ? `Not in this database yet: apply supabase/migrations/${migration} first.` : `Failed: ${error.message}`);
  process.exit(1);
};

// Outreach is CSV on stdout, so the host line goes to stderr where it cannot end up in the file.
(command.kind === "outreach" ? console.error : console.log)(`(${new URL(url).host})\n`);

if (command.kind === "claims") {
  const { data, error } = await db
    .from("place_claims")
    .select("id, role, message, created_at, user_id, places(name)")
    .eq("status", "pending")
    .order("created_at");
  if (error) fail(error, "20261026220000_place_business.sql");
  const claims = await Promise.all(
    data.map(async (c) => {
      const { data: user } = await db.auth.admin.getUserById(c.user_id);
      return { id: c.id, role: c.role, message: c.message, createdAt: c.created_at, placeName: c.places?.name ?? "?", email: user?.user?.email ?? null };
    }),
  );
  console.log(formatClaims(claims));
}

if (command.kind === "promotions") {
  const { data, error } = await db
    .from("place_promotions")
    .select("stripe_subscription_id, status, created_at, places(name)")
    .order("created_at", { ascending: false });
  if (error) fail(error, "20261103100000_place_promotions.sql");
  console.log(formatPromotions(data.map((p) => ({ placeName: p.places?.name ?? "(checkout not received yet)", status: p.status, subscriptionId: p.stripe_subscription_id, since: p.created_at }))));
}

if (command.kind === "outreach") {
  const { data, error } = await db
    .from("places")
    .select("slug, name, categories, website_url, place_locations(city, sort_order)")
    .eq("status", "published")
    // Listed places only: partners already agreed to their page, and the message says "from OpenStreetMap".
    .eq("tier", "listed")
    .is("owner_user_id", null)
    .order("name");
  if (error) fail(error, "20261026220000_place_business.sql");
  const rows = data.map((p) => ({
    slug: p.slug, name: p.name, categories: p.categories ?? [], website: p.website_url,
    city: [...(p.place_locations ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.city ?? "",
  }));
  // Claim links point at the live site: .env.local's NEXT_PUBLIC_SITE_URL is localhost by design.
  console.log(outreachCsv(rows, process.env.PETBNB_PUBLIC_ORIGIN || "https://petbnb.lt"));
}

const SAID = {
  approved: "Approved: the claimant now owns the place and sees it on My business. Other open claims for it were closed.",
  rejected: "Rejected: the claimant sees your reason on My business.",
  not_pending: "Nothing changed: no open claim has that id (already decided, or a typo).",
  place_owned: "Nothing changed: the place already has an owner. Reject this claim with a reason instead.",
  reason_required: "Nothing changed: a rejection needs a reason.",
};

if (command.kind === "approve" || command.kind === "reject") {
  const { data, error } =
    command.kind === "approve"
      ? await db.rpc("approve_place_claim", { p_claim: command.claimId })
      : await db.rpc("reject_place_claim", { p_claim: command.claimId, p_reason: command.reason });
  if (error) fail(error, "20261103110000_place_claim_decisions.sql");
  console.log(SAID[data] ?? `Answer: ${data}`);
  if (data !== "approved" && data !== "rejected") process.exit(1);
}
