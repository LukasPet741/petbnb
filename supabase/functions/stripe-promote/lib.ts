// Pure helpers for stripe-promote: Stripe signature checks and what an event means for a place.
// index.ts calls Deno.serve at module scope, so everything a test needs lives here.

/** Stripe's default tolerance: a signed event older than this is treated as a replay. */
export const TOLERANCE_SECONDS = 300;

/** Places ids are uuids; anything else in client_reference_id is not a place. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stripe's subscription statuses; the database decides which of them count as paying. */
export const SUBSCRIPTION_STATUSES = ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
const isStatus = (v: unknown): v is SubscriptionStatus => SUBSCRIPTION_STATUSES.includes(v as SubscriptionStatus);

/** `Stripe-Signature: t=…,v1=…[,v1=…]`; null when it lacks a timestamp or a v1 signature. */
export function parseSignatureHeader(header: string | null | undefined): { timestamp: number; signatures: string[] } | null {
  if (!header) return null;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key === "t") timestamp = Number(value);
    else if (key === "v1" && value) signatures.push(value);
  }
  return Number.isFinite(timestamp) && signatures.length > 0 ? { timestamp, signatures } : null;
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Compares without stopping at the first difference, so timing says nothing about the secret. */
function equalInTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Stripe signs `${t}.${raw body}` with HMAC-SHA256 under the endpoint's signing secret.
 * Without a secret nothing is accepted: an open endpoint would let anyone promote a place.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds: number,
  tolerance = TOLERANCE_SECONDS,
): Promise<boolean> {
  if (!secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed || Math.abs(nowSeconds - parsed.timestamp) > tolerance) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${parsed.timestamp}.${rawBody}`)));
  return parsed.signatures.some((s) => equalInTime(s, expected));
}

export type PromotionChange =
  | { kind: "start"; placeId: string; subscriptionId: string; customerId: string | null }
  | { kind: "status"; subscriptionId: string; status: SubscriptionStatus }
  | { kind: "ignore"; reason: "malformed" | "event_type" | "not_paid" | "no_place" | "not_a_subscription" };

const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
/** Stripe sends an id, or the expanded object when the endpoint asks for it. */
const idOf = (v: unknown): string | null => text(v) ?? (v && typeof v === "object" ? text((v as { id?: unknown }).id) : null);

/** What a verified Stripe event does to a place's promotion. */
// deno-lint-ignore no-explicit-any
export function promotionChange(event: any): PromotionChange {
  const type = text(event?.type);
  const object = event?.data?.object;
  if (!type || !object || typeof object !== "object") return { kind: "ignore", reason: "malformed" };

  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    if (object.payment_status !== "paid" && object.payment_status !== "no_payment_required") return { kind: "ignore", reason: "not_paid" };
    const placeId = text(object.client_reference_id);
    if (!placeId || !UUID.test(placeId)) return { kind: "ignore", reason: "no_place" };
    const subscriptionId = idOf(object.subscription);
    if (object.mode !== "subscription" || !subscriptionId) return { kind: "ignore", reason: "not_a_subscription" };
    return { kind: "start", placeId: placeId.toLowerCase(), subscriptionId, customerId: idOf(object.customer) };
  }

  if (type === "customer.subscription.deleted" || type === "customer.subscription.updated") {
    const subscriptionId = text(object.id);
    // A deleted subscription is canceled, whatever status the object still carries.
    const status = type === "customer.subscription.deleted" ? "canceled" : object.status;
    if (!subscriptionId || !isStatus(status)) return { kind: "ignore", reason: "malformed" };
    return { kind: "status", subscriptionId, status };
  }

  return { kind: "ignore", reason: "event_type" };
}
