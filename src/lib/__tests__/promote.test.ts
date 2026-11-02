import { describe, it, expect } from "vitest";
import { PROMOTE_PLAN, PAID_KEY, notePaidReturn, paidRecently, promoteCheckoutUrl, promotePortalUrl } from "@/lib/promote";

const LINK = "https://buy.stripe.com/test_abc123";
const PLACE = "3f6c2a1e-9b7d-4c1a-8e2f-0a1b2c3d4e5f";

describe("promoteCheckoutUrl", () => {
  it("is null while no Payment Link is configured, so nothing is sold", () => {
    expect(promoteCheckoutUrl(undefined, PLACE)).toBeNull();
    expect(promoteCheckoutUrl("", PLACE)).toBeNull();
  });

  it("names the place in client_reference_id, so each Stripe payment says what it is for", () => {
    const url = new URL(promoteCheckoutUrl(LINK, PLACE)!);
    expect(url.origin + url.pathname).toBe(LINK);
    expect(url.searchParams.get("client_reference_id")).toBe(PLACE);
    expect(url.searchParams.has("prefilled_email")).toBe(false);
  });

  it("prefills the owner's email when there is one", () => {
    const url = new URL(promoteCheckoutUrl(LINK, PLACE, "owner+shop@example.com")!);
    expect(url.searchParams.get("prefilled_email")).toBe("owner+shop@example.com");
    expect(new URL(promoteCheckoutUrl(LINK, PLACE, "not-an-email")!).searchParams.has("prefilled_email")).toBe(false);
  });

  it("refuses a link that is not https, or not a URL", () => {
    expect(promoteCheckoutUrl("http://buy.stripe.com/x", PLACE)).toBeNull();
    expect(promoteCheckoutUrl("javascript:alert(1)", PLACE)).toBeNull();
    expect(promoteCheckoutUrl("buy.stripe.com/x", PLACE)).toBeNull();
  });

  it("refuses a place id Stripe would reject as a reference", () => {
    expect(promoteCheckoutUrl(LINK, "")).toBeNull();
    expect(promoteCheckoutUrl(LINK, "a b")).toBeNull();
    expect(promoteCheckoutUrl(LINK, "x".repeat(201))).toBeNull();
  });

  it("keeps query parameters the link already carries", () => {
    const url = new URL(promoteCheckoutUrl(`${LINK}?locale=lt`, PLACE)!);
    expect(url.searchParams.get("locale")).toBe("lt");
  });
});

describe("PROMOTE_PLAN", () => {
  it("quotes a positive monthly price", () => {
    expect(PROMOTE_PLAN.priceEur).toBeGreaterThan(0);
    expect(PROMOTE_PLAN.period).toBe("month");
  });
});

describe("formatPromotePrice", () => {
  it("writes the plan's price in euros for each language", async () => {
    const { formatPromotePrice } = await import("@/lib/promote");
    expect(formatPromotePrice("en")).toMatch(/€\s?19/);
    expect(formatPromotePrice("lt")).toMatch(/19\s?€/);
  });
});

describe("paid return", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };
  const DAY = 86_400_000;

  it("remembers that Stripe sent the owner back after paying", () => {
    const s = store();
    expect(notePaidReturn("?paid=1", s, 1_000)).toBe(true);
    expect(s.m.get(PAID_KEY)).toBe("1000");
    expect(paidRecently(s, 1_000 + DAY)).toBe(true);
  });

  it("forgets it after three days, by when the promotion is on or something went wrong", () => {
    const s = store();
    notePaidReturn("?paid=1", s, 0);
    expect(paidRecently(s, 3 * DAY + 1)).toBe(false);
  });

  it("ignores a visit without the return, and storage that throws", () => {
    const s = store();
    expect(notePaidReturn("?p=x", s, 0)).toBe(false);
    expect(paidRecently(s, 0)).toBe(false);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(notePaidReturn("?paid=1", broken, 0)).toBe(true);
    expect(paidRecently(broken, 0)).toBe(false);
  });
});

describe("promotePortalUrl", () => {
  it("is Stripe's customer portal login, with the owner's email filled in", () => {
    const url = new URL(promotePortalUrl("https://billing.stripe.com/p/login/test_abc", "owner@example.com")!);
    expect(url.origin + url.pathname).toBe("https://billing.stripe.com/p/login/test_abc");
    expect(url.searchParams.get("prefilled_email")).toBe("owner@example.com");
  });

  it("is null while none is configured, or for a link that is not https", () => {
    expect(promotePortalUrl(undefined, null)).toBeNull();
    expect(promotePortalUrl("http://billing.stripe.com/p/login/x", null)).toBeNull();
    expect(promotePortalUrl("javascript:alert(1)", null)).toBeNull();
  });
});
