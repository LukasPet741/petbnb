import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "@/app/(app)/profile/page";

/**
 * Saving /profile must update EVERY copy of the profile, not just this page's. The app layout
 * holds its own, and its guard sends any incomplete profile back to /profile. Lukas, 2026-10-18:
 * a new account saved name and phone, then could not open the Smart-ID demo or the collar page
 * until he reloaded the site.
 *
 * Rendered without a LanguageProvider, so `t` returns the key.
 */

const h = vi.hoisted(() => ({
  user: { id: "u1", email: "u1@example.com" },
  profile: {
    id: "u1", full_name: null as string | null, phone: null as string | null, city: null as string | null,
    about_me: null, experience_years: null, is_sitter: false, services: {}, prices: {}, avatar_url: null,
    verification_method: "none",
  },
  order: [] as string[],
  push: vi.fn(),
  search: "",
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: h.profile, refresh: vi.fn(async () => { h.order.push("own refresh"); }) }),
  notifyProfileChanged: vi.fn(async () => { h.order.push("every copy"); }),
}));
vi.mock("@/hooks/useBusyDays", () => ({ useBusyDays: () => ({ busy: new Map(), reload: vi.fn() }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (path: string) => { h.order.push(`push ${path}`); h.push(path); } }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }) },
}));
vi.mock("@/components/AccountData", () => ({ default: () => null }));
vi.mock("@/components/ImageUpload", () => ({ default: () => null }));

beforeEach(() => {
  h.order = [];
  h.push.mockReset();
  window.history.replaceState(null, "", "/profile?next=%2Fsmart-id-demo");
});

describe("/profile save", () => {
  it("refreshes every copy of the profile before going on to ?next=", async () => {
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText("appPages.profile.fullNameLabel"), { target: { value: "Lukas P." } });
    fireEvent.change(screen.getByLabelText("appPages.profile.cityLabel"), { target: { value: "Vilnius" } });
    fireEvent.change(screen.getByLabelText("appPages.profile.phoneLabel"), { target: { value: "61234567" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.profile.saveChangesButton" }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/smart-id-demo"));
    expect(h.order).toEqual(["every copy", "push /smart-id-demo"]);
  });
});
