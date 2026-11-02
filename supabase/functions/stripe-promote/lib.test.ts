import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { parseSignatureHeader, promotionChange, verifyStripeSignature } from "./lib.ts";

// Runs in the `edge` Vitest project (node environment). index.ts calls Deno.serve and is not imported.

const SECRET = "whsec_test_secret";
const NOW = 1_762_000_000;
const sign = (body: string, t: number, secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
const PLACE = "3f6c2a1e-9b7d-4c1a-8e2f-0a1b2c3d4e5f";

describe("parseSignatureHeader", () => {
  it("reads the timestamp and every v1 signature", () => {
    expect(parseSignatureHeader("t=12,v1=aa,v0=zz,v1=bb")).toEqual({ timestamp: 12, signatures: ["aa", "bb"] });
  });

  it("is null without a timestamp or a v1 signature", () => {
    expect(parseSignatureHeader("v1=aa")).toBeNull();
    expect(parseSignatureHeader("t=12")).toBeNull();
    expect(parseSignatureHeader("")).toBeNull();
    expect(parseSignatureHeader(null)).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

  it("accepts a body Stripe signed with this endpoint's secret", async () => {
    expect(await verifyStripeSignature(body, sign(body, NOW), SECRET, NOW)).toBe(true);
  });

  it("accepts it when one of several signatures matches (secret rotation)", async () => {
    const header = `t=${NOW},v1=${"0".repeat(64)},${sign(body, NOW).split(",")[1]}`;
    expect(await verifyStripeSignature(body, header, SECRET, NOW)).toBe(true);
  });

  it("refuses another secret, a changed body, or a missing header", async () => {
    expect(await verifyStripeSignature(body, sign(body, NOW, "whsec_other"), SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body + " ", sign(body, NOW), SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body, null, SECRET, NOW)).toBe(false);
  });

  it("refuses a replay older than five minutes", async () => {
    expect(await verifyStripeSignature(body, sign(body, NOW - 301), SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body, sign(body, NOW - 299), SECRET, NOW)).toBe(true);
  });

  it("refuses everything while no secret is configured", async () => {
    expect(await verifyStripeSignature(body, sign(body, NOW, ""), "", NOW)).toBe(false);
  });
});

const completed = (session: Record<string, unknown>, type = "checkout.session.completed") => ({
  id: "evt_1", type,
  data: { object: { object: "checkout.session", mode: "subscription", payment_status: "paid", client_reference_id: PLACE, subscription: "sub_1", customer: "cus_1", ...session } },
});

describe("promotionChange", () => {
  it("starts a promotion when a subscription checkout for a place is paid", () => {
    expect(promotionChange(completed({}))).toEqual({ kind: "start", placeId: PLACE, subscriptionId: "sub_1", customerId: "cus_1" });
  });

  it("starts one when a delayed payment succeeds", () => {
    expect(promotionChange(completed({ payment_status: "paid" }, "checkout.session.async_payment_succeeded")).kind).toBe("start");
  });

  it("waits while the checkout is not paid yet", () => {
    expect(promotionChange(completed({ payment_status: "unpaid" }))).toEqual({ kind: "ignore", reason: "not_paid" });
  });

  it("ignores a checkout without a place, or with one that is not a place id", () => {
    expect(promotionChange(completed({ client_reference_id: null }))).toEqual({ kind: "ignore", reason: "no_place" });
    expect(promotionChange(completed({ client_reference_id: "'; drop table places;--" }))).toEqual({ kind: "ignore", reason: "no_place" });
  });

  it("ignores a one-off payment, which would never end", () => {
    expect(promotionChange(completed({ mode: "payment", subscription: null }))).toEqual({ kind: "ignore", reason: "not_a_subscription" });
  });

  it("reports a deleted subscription as canceled", () => {
    const event = { id: "evt_2", type: "customer.subscription.deleted", data: { object: { object: "subscription", id: "sub_1", status: "active" } } };
    expect(promotionChange(event)).toEqual({ kind: "status", subscriptionId: "sub_1", status: "canceled" });
  });

  it("reports every status an update carries, for the database to judge", () => {
    const updated = (status: string) => ({ id: "evt_3", type: "customer.subscription.updated", data: { object: { object: "subscription", id: "sub_1", status } } });
    for (const status of ["active", "past_due", "unpaid", "canceled", "paused"]) {
      expect(promotionChange(updated(status))).toEqual({ kind: "status", subscriptionId: "sub_1", status });
    }
    expect(promotionChange(updated("made_up"))).toEqual({ kind: "ignore", reason: "malformed" });
  });

  it("ignores every other event and anything malformed", () => {
    expect(promotionChange({ id: "evt_4", type: "invoice.paid", data: { object: {} } })).toEqual({ kind: "ignore", reason: "event_type" });
    expect(promotionChange(null)).toEqual({ kind: "ignore", reason: "malformed" });
    expect(promotionChange({ type: "customer.subscription.deleted", data: { object: {} } })).toEqual({ kind: "ignore", reason: "malformed" });
  });
});

describe("the place_promotions migration", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { SUBSCRIPTION_STATUSES } = await import("./lib.ts");
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261103100000_place_promotions.sql"), "utf8").replace(/--.*$/gm, "");

  it("accepts exactly the statuses the function reports", () => {
    const listed = sql.match(/check \(status in \(([^)]*)\)\)/)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
    expect([...listed].sort()).toEqual([...SUBSCRIPTION_STATUSES].sort());
  });

  it("counts a place promoted only while a subscription is paying", () => {
    expect(sql).toMatch(/r\.status in \('active', 'trialing', 'past_due'\)/);
  });

  it("keeps the table and both functions away from browsers", () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.place_promotions from anon, authenticated/);
    for (const fn of ["_refresh_place_promotion(uuid)", "start_place_promotion(text, uuid, text)", "set_place_promotion_status(text, text)"]) {
      expect(sql).toContain(`revoke all on function public.${fn} from public, anon, authenticated`);
    }
    expect(sql).not.toMatch(/grant [^;]* to (anon|authenticated)/);
  });

  it("never revives a canceled subscription", () => {
    expect(sql).toMatch(/status <> 'canceled'/);
  });
});
