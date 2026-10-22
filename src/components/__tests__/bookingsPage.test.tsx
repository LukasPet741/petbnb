import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BookingsPage from "@/app/(app)/bookings/page";

/**
 * /bookings shows both sides of every booking the viewer is party to. It used to pick its
 * query from the profile (sitters: both sides, everyone else: own requests only), but the
 * profile is still loading on the first render, so a sitter's first fetch was owner-only. When
 * that answer landed after the full one, the request waiting on the sitter vanished from the
 * page, Accept button and all. RLS already limits the rows to the viewer's own bookings.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function.
 */

const h = vi.hoisted(() => ({
  profile: null as null | { is_sitter: boolean },
  queries: [] as string[],
  rows: null as unknown[] | null,
  // Stable, as AuthContext's is: a fresh object every render would refetch every render.
  user: { id: "s1" },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));
// The first render's state: the profile has not answered yet.
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ profile: h.profile, loading: h.profile === null }) }));
vi.mock("@/hooks/useMyReviews", () => ({ useMyReviews: () => ({ reviews: new Map(), saveReview: vi.fn(), error: null }) }));
vi.mock("@/components/RightRail", () => ({ default: () => null }));
vi.mock("@/components/BookingWalks", () => ({ default: (p: { bookingId: string }) => <div data-testid="walks">{p.bookingId}</div> }));

const REQUEST = {
  id: "b1", status: "pending", service: "walking",
  start_at: "2030-05-01T08:00:00Z", end_at: "2030-05-01T10:00:00Z", notes: null, address: null,
  owner_id: "o1", sitter_id: "s1", asking_price: 25, agreed_price: null,
  sitter: { id: "s1", full_name: "Rūta K.", avatar_url: null },
  owner: { id: "o1", full_name: "Ona P.", avatar_url: null },
  pet: { id: "p1", name: "Rex", photo_url: null },
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        if (table === "messages") {
          return { eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
        }
        return {
          // Both sides: the request made with this sitter is among the rows.
          or: (filter: string) => {
            h.queries.push(`or:${filter}`);
            return { order: () => Promise.resolve({ data: h.rows ?? [REQUEST], error: null }) };
          },
          // Own requests only: the sitter's incoming request is not.
          eq: (column: string) => {
            h.queries.push(`eq:${column}`);
            return { order: () => Promise.resolve({ data: [], error: null }) };
          },
        };
      },
    }),
  },
}));

beforeEach(() => {
  h.profile = null;
  h.queries = [];
  h.rows = null;
});

describe("/bookings", () => {
  it("shows a sitter the request waiting on them before their profile has loaded", async () => {
    render(<BookingsPage />);
    expect(await screen.findByRole("button", { name: "appPages.bookings.acceptForButton" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "appPages.bookings.declineButton" })).toBeInTheDocument();
    // The sitter is never offered the owner's way out of their own incoming request.
    expect(screen.queryByRole("button", { name: "appPages.bookings.cancelRequestButton" })).not.toBeInTheDocument();
  });

  it("reads both sides in one query, whatever the profile says", async () => {
    h.profile = { is_sitter: false };
    render(<BookingsPage />);
    await screen.findByRole("button", { name: "appPages.bookings.acceptForButton" });
    expect(h.queries).toEqual(["or:owner_id.eq.s1,sitter_id.eq.s1"]);
  });

  it("gives walk controls to the sitter's stays only, never to the owner's", async () => {
    h.rows = [
      { ...REQUEST, id: "as-sitter", status: "signed", agreed_price: 25 },
      { ...REQUEST, id: "as-owner", status: "signed", agreed_price: 25, owner_id: "s1", sitter_id: "o2",
        owner: { id: "s1", full_name: "Rūta K.", avatar_url: null }, sitter: { id: "o2", full_name: "Tomas", avatar_url: null } },
    ];
    render(<BookingsPage />);
    const slots = await screen.findAllByTestId("walks");
    expect(slots.map((el) => el.textContent)).toEqual(["as-sitter"]);
  });
});
