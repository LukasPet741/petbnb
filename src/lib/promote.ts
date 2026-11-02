/**
 * Promoted placement, the one paid thing on the places map: places.is_promoted, a flag on top of
 * any tier (20261103090000), set by an admin only; the map and the list label it as an ad.
 *
 * Payment is a Stripe Payment Link, so the site itself holds no payment secret:
 *   1. Lukas creates a recurring Payment Link in Stripe for PROMOTE_PLAN and sets its URL as
 *      NEXT_PUBLIC_PROMOTE_CHECKOUT_URL (Vercel → Project → Environment Variables), then redeploys.
 *   2. A place owner opens it from My business. The place id rides along as client_reference_id,
 *      so each payment in Stripe names the place it is for.
 *   3. supabase/functions/stripe-promote sets that place's is_promoted from the subscription (or an
 *      admin does it by hand). Until the variable is set, nothing is sold.
 */

/** Edit here to change what My business quotes; keep it equal to the Payment Link's price. */
export const PROMOTE_PLAN = { priceEur: 19, period: "month" } as const;

/** The plan's price as the page shows it ("19 €" in Lithuanian, "€19" in English). */
export const formatPromotePrice = (locale: string): string =>
  new Intl.NumberFormat(locale === "lt" ? "lt-LT" : "en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(PROMOTE_PLAN.priceEur);

/** Stripe's limit for client_reference_id: letters, digits, dashes and underscores, up to 200. */
const REFERENCE = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * The checkout link for one place, or null when promotion is not on sale: no link configured,
 * a link that is not https, or a place id Stripe would refuse as a reference.
 */
export function promoteCheckoutUrl(base: string | undefined, placeId: string, email?: string | null): string | null {
  if (!REFERENCE.test(placeId)) return null;
  const url = httpsUrl(base);
  if (!url) return null;
  url.searchParams.set("client_reference_id", placeId);
  if (email && email.includes("@")) url.searchParams.set("prefilled_email", email);
  return url.toString();
}

/**
 * Stripe's customer portal login link (Settings → Billing → Customer portal), where a paying
 * business manages or cancels its subscription; null while none is configured.
 */
export function promotePortalUrl(base: string | undefined, email?: string | null): string | null {
  const url = httpsUrl(base);
  if (!url) return null;
  if (email && email.includes("@")) url.searchParams.set("prefilled_email", email);
  return url.toString();
}

/** A configured link, only when it is an https URL. */
function httpsUrl(base: string | undefined): URL | null {
  if (!base) return null;
  try {
    const url = new URL(base.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Where My business keeps the time Stripe sent the owner back after paying (per browser). */
export const PAID_KEY = "petbnb-promote-paid";
const PAID_FOR_MS = 3 * 86_400_000;
type Store = Pick<Storage, "getItem" | "setItem">;

/**
 * The Payment Link redirects to /business?paid=1 after a payment. Remember it, so the card says
 * the payment is in instead of offering a second one while promotion switches on. Answers whether
 * this visit is that return; a storage that throws only loses the memory.
 */
export function notePaidReturn(search: string, store: Store, now: number): boolean {
  if (new URLSearchParams(search).get("paid") !== "1") return false;
  try {
    store.setItem(PAID_KEY, String(now));
  } catch {
    // private mode or blocked storage: this visit still knows, from the URL
  }
  return true;
}

/** Whether this browser came back from paying in the last three days. */
export function paidRecently(store: Store, now: number): boolean {
  try {
    const at = Number(store.getItem(PAID_KEY));
    return at > 0 && now - at <= PAID_FOR_MS;
  } catch {
    return false;
  }
}

/** The configured Payment Link. Read literally so Next inlines it at build time. */
export const promoteCheckoutBase = (): string | undefined => process.env.NEXT_PUBLIC_PROMOTE_CHECKOUT_URL;

/** The configured customer portal login link, the same way. */
export const promotePortalBase = (): string | undefined => process.env.NEXT_PUBLIC_PROMOTE_PORTAL_URL;
