import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SitterProfilePage from "@/app/(app)/browse/[id]/page";

/**
 * An owner sees which days a sitter is taken before asking (/browse/[id]). Read-only, fed by
 * sitter_busy_days, which says a day is taken and whether by a day off or a booking, never
 * by whom.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function.
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  sitter: {
    id: "s1", full_name: "Rūta K.", city: "Kaunas", experience_years: 3, about_me: null,
    is_sitter: true, services: { walking: true }, prices: { walking: { amount: 10, days: 1 } },
    verification_method: "seed", verified_at: null, avatar_url: null,
  },
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "s1" }) }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: h.rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: h.sitter, error: null }) }) }) }),
  },
}));
vi.mock("@/hooks/useSitterRatings", () => ({ useSitterRatings: () => new Map() }));
vi.mock("@/components/ReviewList", () => ({ default: () => null }));
vi.mock("@/components/FavoriteButton", () => ({ default: () => null }));
vi.mock("@/components/SitterCover", () => ({ default: () => null }));

const day = (iso: string) => screen.getByRole("button", { name: new RegExp(`^${iso} `) });

beforeEach(() => {
  // Only Date is faked, ticking with real time, so findBy* can still time out.
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-10T12:00:00+03:00"));
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({
    data: [
      { day: "2026-10-12", kind: "off" },
      { day: "2026-10-14", kind: "booked" },
    ],
    error: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("/browse/[id] availability", () => {
  it("reads this sitter's busy days for the two months it shows", async () => {
    render(<SitterProfilePage />);
    await screen.findByText("appPages.availability.heading");
    expect(h.rpc).toHaveBeenCalledWith("sitter_busy_days", { p_sitter: "s1", p_from: "2026-10-10", p_to: "2026-12-19" });
  });

  it("shows away and booked days, read-only", async () => {
    render(<SitterProfilePage />);
    await screen.findByText("appPages.availability.viewHint");
    expect(await screen.findByRole("button", { name: /^2026-10-12 .*appPages\.availability\.state\.off/ })).toBeDisabled();
    expect(day("2026-10-14")).toHaveAccessibleName(/appPages\.availability\.state\.booked/);
    expect(day("2026-10-11")).toBeDisabled();
    expect(day("2026-10-11")).not.toHaveAttribute("aria-pressed");
  });
});
