import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PromoteCard from "@/components/business/PromoteCard";
import type { OwnedPlace } from "@/lib/placeBusiness";

/** Rendered without a LanguageProvider, so every label is the key it asked for. */

const auth = vi.hoisted(() => ({ user: { id: "u-1", email: "owner@example.com" } as null | { id: string; email?: string } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: auth.user, session: null, loading: false }) }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const LINK = "https://buy.stripe.com/test_abc123";
const place: OwnedPlace = {
  id: "pl-1", slug: "dogiday", name: "Dogiday", tier: "partner", status: "published",
  descriptionLt: "", descriptionEn: "", hoursLt: "", hoursEn: "", website: "", accepts: [], services: [],
};

beforeEach(() => {
  auth.user = { id: "u-1", email: "owner@example.com" };
});

describe("PromoteCard", () => {
  it("offers a partner's page a checkout that names the place and the owner", () => {
    render(<PromoteCard place={place} checkoutBase={LINK} />);
    const link = screen.getByRole("link", { name: /partners.forBusiness.promote.button/ });
    const url = new URL(link.getAttribute("href")!);
    expect(url.searchParams.get("client_reference_id")).toBe("pl-1");
    expect(url.searchParams.get("prefilled_email")).toBe("owner@example.com");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("offers a listed page the same", () => {
    render(<PromoteCard place={{ ...place, tier: "listed" }} checkoutBase={LINK} />);
    expect(screen.getByRole("link", { name: /promote.button/ })).toBeTruthy();
  });

  it("shows nothing while no Payment Link is configured", () => {
    const { container } = render(<PromoteCard place={place} checkoutBase={undefined} />);
    expect(container.textContent).toBe("");
  });

  it("shows nothing for a page that is not published", () => {
    const { container } = render(<PromoteCard place={{ ...place, status: "draft" }} checkoutBase={LINK} />);
    expect(container.textContent).toBe("");
  });

  it("does not offer a Bookable page, since promoting it would end its booking requests", () => {
    const { container } = render(<PromoteCard place={{ ...place, tier: "bookable" }} checkoutBase={LINK} />);
    expect(container.textContent).toBe("");
  });

  it("says a promoted page is promoted, with nothing to buy", () => {
    render(<PromoteCard place={{ ...place, tier: "promoted" }} checkoutBase={LINK} />);
    expect(screen.getByText("partners.forBusiness.promote.activeTitle")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
