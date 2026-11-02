// Promoted placement, switched on and off by Stripe (docs/promoted-placement.md).
//
// Stripe POSTs signed events here. A paid subscription checkout whose client_reference_id is a
// place id starts a promotion; every later subscription status is recorded, and the database
// decides whether the place is still promoted. Nothing in the body is trusted until the
// Stripe-Signature header checks out against STRIPE_WEBHOOK_SECRET; without that secret every
// request is refused.
//
// Stripe retries any non-2xx for days, so only an unsigned request (400) or a database we cannot
// reach (500) earns one. Events we do not act on answer 200 with the reason, which Stripe shows
// in its dashboard next to the event.
import { createClient } from "npm:@supabase/supabase-js@2";
import { promotionChange, verifyStripeSignature } from "./lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim() ?? "";
// The Promoted Payment Link's id (plink_…). Only its checkouts start a promotion; see lib.ts.
const PAYMENT_LINK = Deno.env.get("STRIPE_PROMOTE_PAYMENT_LINK")?.trim() ?? "";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // The signature covers the exact bytes Stripe sent, so read the body as text before parsing it.
  const raw = await req.text();
  const signed = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
  if (!signed) return json({ error: "Invalid signature" }, 400);

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const change = promotionChange(event, PAYMENT_LINK);
  if (change.kind === "ignore") return json({ ok: true, status: "ignored", reason: change.reason }, 200);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } =
    change.kind === "start"
      ? await supabase.rpc("start_place_promotion", { p_subscription: change.subscriptionId, p_place: change.placeId, p_customer: change.customerId, p_at: change.at })
      : await supabase.rpc("set_place_promotion_status", { p_subscription: change.subscriptionId, p_status: change.status, p_at: change.at });

  if (error) {
    console.error("stripe-promote: database call failed", change.kind, error.message);
    return json({ error: "Database unavailable" }, 500);
  }
  return json({ ok: true, status: data }, 200);
});
