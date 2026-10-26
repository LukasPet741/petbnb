import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlaceCommunity from "@/components/partners/PlaceCommunity";
import type { PlaceCommunity as Community } from "@/lib/placeCommunity";

/** Rendered without a LanguageProvider, so every label is the key it asked for. */

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: auth.user, session: null, loading: false }) }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const lib = vi.hoisted(() => ({
  fetchCommunity: vi.fn(),
  fetchMyReview: vi.fn(),
  fetchMyPets: vi.fn(),
  fetchMyPetPlaces: vi.fn(),
  reportContent: vi.fn(),
  saveReview: vi.fn(),
}));
vi.mock("@/lib/placeCommunity", async (original) => ({ ...(await original<object>()), ...lib }));

const community: Community = {
  placeId: "pl-1",
  average: 4,
  count: 1,
  reviews: [{ id: "r1", rating: 4, body: "Gera vieta", createdAt: "2026-10-20T10:00:00Z", author: "Emilija A.", mine: false }],
  posts: [{ id: "p1", body: "Reksas loved it", createdAt: "2026-10-21T10:00:00Z", author: "Jonas", mine: false, petName: "Reksas", petType: "dog", petId: "pet-1" }],
  pets: [{ id: "pet-1", name: "Reksas", type: "dog", photoUrl: null }],
};

beforeEach(() => {
  auth.user = null;
  vi.clearAllMocks();
  lib.fetchMyReview.mockResolvedValue(null);
  lib.fetchMyPets.mockResolvedValue([]);
  lib.fetchMyPetPlaces.mockResolvedValue(new Set());
});

describe("PlaceCommunity", () => {
  it("leaves the panel alone until the community tables are live", async () => {
    lib.fetchCommunity.mockResolvedValue(null);
    const { container } = render(<PlaceCommunity slug="dogiday" />);
    await waitFor(() => expect(lib.fetchCommunity).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("shows reviews, visits and pets to anyone, and asks a visitor to sign in to take part", async () => {
    lib.fetchCommunity.mockResolvedValue(community);
    render(<PlaceCommunity slug="dogiday" />);
    expect(await screen.findByText("Gera vieta")).toBeTruthy();
    expect(screen.getByText("Reksas loved it")).toBeTruthy();
    expect(screen.getByRole("link", { name: "partners.community.signIn" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /partners.community.report/ })).toBeNull();
    expect(screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/p/pet-1")).toBe(true);
  });

  it("lets a signed-in owner rate the place", async () => {
    auth.user = { id: "u1" };
    lib.fetchCommunity.mockResolvedValue(community);
    lib.saveReview.mockResolvedValue(null);
    render(<PlaceCommunity slug="dogiday" />);
    await screen.findByText("Gera vieta");
    fireEvent.click(screen.getAllByRole("radio")[4]);
    fireEvent.click(screen.getByRole("button", { name: "partners.community.postReview" }));
    await waitFor(() => expect(lib.saveReview).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ placeId: "pl-1", rating: 5 })));
  });

  it("files a report with a reason", async () => {
    auth.user = { id: "u1" };
    lib.fetchCommunity.mockResolvedValue(community);
    lib.reportContent.mockResolvedValue("sent");
    render(<PlaceCommunity slug="dogiday" />);
    await screen.findByText("Gera vieta");
    fireEvent.click(screen.getAllByRole("button", { name: /partners.community.report/ })[0]);
    fireEvent.click(screen.getByLabelText("partners.community.reasons.offensive"));
    fireEvent.click(screen.getByRole("button", { name: "partners.community.send" }));
    await waitFor(() => expect(lib.reportContent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ targetType: "place_review", targetId: "r1", reason: "offensive" })));
    expect(await screen.findByText("partners.community.reported")).toBeTruthy();
  });

  it("tells the author why their review was hidden", async () => {
    auth.user = { id: "u1" };
    lib.fetchCommunity.mockResolvedValue({ ...community, reviews: [] });
    lib.fetchMyReview.mockResolvedValue({ id: "r9", rating: 1, body: "x", hiddenReason: "Not about this place" });
    render(<PlaceCommunity slug="dogiday" />);
    expect(await screen.findByText("partners.community.hidden")).toBeTruthy();
  });
});
