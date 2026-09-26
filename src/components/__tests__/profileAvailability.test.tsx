import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "@/app/(app)/profile/page";

/**
 * The sitter's own availability calendar on /profile (Sitter tab). A tap writes one row to
 * sitter_days_off at once, independent of "Save profile", because it is a separate table.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function.
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  deleteEqDay: vi.fn(),
  deleteEqSitter: vi.fn(),
  profileUpdate: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" }, session: {}, loading: false }) }));
// One object for every render: the page resets its form whenever `profile` changes identity,
// so a fresh object per call would re-render forever.
const profileState = vi.hoisted(() => ({
  profile: {
    id: "me", full_name: "Lina", phone: "", city: "Vilnius", about_me: "", experience_years: null,
    is_sitter: true, services: { walking: true }, prices: { walking: { amount: 10, days: 1 } },
    verification_method: "none", avatar_url: null,
  },
  loading: false,
  refresh: () => Promise.resolve(),
}));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => profileState }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/profile",
}));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: h.rpc,
    from: (table: string) =>
      table === "sitter_days_off"
        ? { insert: h.insert, delete: () => ({ eq: h.deleteEqSitter }) }
        : { update: h.profileUpdate },
  },
}));
vi.mock("@/components/ImageUpload", () => ({ default: () => null }));

const day = (iso: string) => screen.getByRole("button", { name: new RegExp(`^${iso} `) });

async function openSitterTab() {
  render(<ProfilePage />);
  fireEvent.click(screen.getByRole("button", { name: "appPages.profile.tabSitterSettings" }));
  // The tab animates in (AnimatePresence), and the busy-days read starts as soon as the profile
  // loads, so wait for the calendar itself rather than for the call.
  await screen.findByText("appPages.availability.heading");
}

beforeEach(() => {
  // Only Date is faked, and it ticks with real time, so waitFor can still time out.
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-10T12:00:00+03:00"));
  for (const fn of Object.values(h)) fn.mockReset();
  h.rpc.mockResolvedValue({ data: [{ day: "2026-10-12", kind: "off" }], error: null });
  h.insert.mockResolvedValue({ error: null });
  h.deleteEqDay.mockResolvedValue({ error: null });
  h.deleteEqSitter.mockReturnValue({ eq: h.deleteEqDay });
  h.profileUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("/profile availability", () => {
  it("reads the sitter's own busy days from today for ten weeks", async () => {
    await openSitterTab();
    expect(h.rpc).toHaveBeenCalledWith("sitter_busy_days", { p_sitter: "me", p_from: "2026-10-10", p_to: "2026-12-19" });
    expect(screen.getByText("appPages.availability.heading")).toBeInTheDocument();
  });

  it("tapping a free day saves it as a day off at once, without saving the profile", async () => {
    await openSitterTab();
    await waitFor(() => expect(day("2026-10-12")).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(day("2026-10-11"));
    await waitFor(() => expect(h.insert).toHaveBeenCalledWith({ sitter_id: "me", day: "2026-10-11" }));
    expect(h.profileUpdate).not.toHaveBeenCalled();
    await waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(2));
  });

  it("tapping a day off deletes exactly that day", async () => {
    await openSitterTab();
    await waitFor(() => expect(day("2026-10-12")).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(day("2026-10-12"));
    await waitFor(() => expect(h.deleteEqDay).toHaveBeenCalledWith("day", "2026-10-12"));
    expect(h.deleteEqSitter).toHaveBeenCalledWith("sitter_id", "me");
  });

  it("says so when a day cannot be saved", async () => {
    h.insert.mockResolvedValue({ error: { message: "nope" } });
    await openSitterTab();
    fireEvent.click(day("2026-10-11"));
    expect(await screen.findByRole("alert")).toHaveTextContent("appPages.availability.saveFailed");
  });
});
