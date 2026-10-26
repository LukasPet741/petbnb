import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlaceBusinessActions from "@/components/partners/PlaceBusinessActions";
import type { Partner } from "@/lib/partners";

/** Rendered without a LanguageProvider, so every label is the key it asked for. */

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: auth.user, session: null, loading: false }) }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const biz = vi.hoisted(() => ({ claimPlace: vi.fn(), requestBooking: vi.fn(), fetchMyRequestsAt: vi.fn(), cancelRequest: vi.fn() }));
vi.mock("@/lib/placeBusiness", async (original) => ({ ...(await original<object>()), ...biz }));
vi.mock("@/lib/placeCommunity", async (original) => ({ ...(await original<object>()), fetchMyPets: vi.fn().mockResolvedValue([]) }));

const place: Partner = {
  id: "pl-1", slug: "dogiday", name: "Dogiday", tier: "partner", categories: ["grooming"], accepts: ["dog"], locations: [],
  services: [{ name: { lt: "Kirpimas", en: "Grooming" } }],
};

beforeEach(() => {
  auth.user = null;
  vi.clearAllMocks();
  biz.fetchMyRequestsAt.mockResolvedValue([]);
});

describe("PlaceBusinessActions", () => {
  it("stays out of the panel for a place from the built-in list (no id yet)", () => {
    const { container } = render(<PlaceBusinessActions place={{ ...place, id: undefined }} />);
    expect(container.textContent).toBe("");
  });

  it("offers no booking where the place is not Bookable", () => {
    render(<PlaceBusinessActions place={place} />);
    expect(screen.queryByText("partners.forBusiness.book.heading")).toBeNull();
    expect(screen.getByRole("button", { name: /partners.forBusiness.claim.link/ })).toBeTruthy();
  });

  it("asks a visitor to sign in before requesting a booking", () => {
    render(<PlaceBusinessActions place={{ ...place, tier: "bookable" }} />);
    expect(screen.getByRole("link", { name: "partners.forBusiness.book.signIn" }).getAttribute("href")).toContain("/login");
  });

  it("sends a signed-in owner's booking request for the chosen service", async () => {
    auth.user = { id: "u1" };
    biz.requestBooking.mockResolvedValue(null);
    render(<PlaceBusinessActions place={{ ...place, tier: "bookable" }} />);
    fireEvent.click(await screen.findByRole("button", { name: "partners.forBusiness.book.send" }));
    await waitFor(() => expect(biz.requestBooking).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ placeId: "pl-1", time: "morning" })));
  });

  it("files a claim and points to My business", async () => {
    auth.user = { id: "u1" };
    biz.claimPlace.mockResolvedValue("sent");
    render(<PlaceBusinessActions place={place} />);
    fireEvent.click(screen.getByRole("button", { name: /partners.forBusiness.claim.link/ }));
    fireEvent.click(screen.getByLabelText("partners.forBusiness.claim.roles.manager"));
    fireEvent.click(screen.getByRole("button", { name: "partners.forBusiness.claim.send" }));
    await waitFor(() => expect(biz.claimPlace).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ placeId: "pl-1", role: "manager" })));
    expect((await screen.findByRole("link", { name: "partners.forBusiness.claim.open" })).getAttribute("href")).toBe("/business");
  });
});
