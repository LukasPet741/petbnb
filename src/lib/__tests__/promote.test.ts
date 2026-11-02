import { describe, it, expect } from "vitest";
import { PROMOTE_PLAN, promoteCheckoutUrl } from "@/lib/promote";

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
