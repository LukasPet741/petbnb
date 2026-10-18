import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProfilePage from "@/app/(app)/profile/page";

/**
 * Every field on /profile is reachable by its label, and the Sitter mode switch says what it
 * is and whether it is on. Name, city, about-me and experience were bare <label>s next to
 * their inputs, and the switch was an unnamed button: a screen reader heard "button".
 *
 * Rendered without a LanguageProvider, so `t` returns the key and getByLabelText matches it.
 */

const h = vi.hoisted(() => ({
  user: { id: "u1", email: "u1@example.com" },
  profile: {
    id: "u1", full_name: "Ona P.", phone: "+37061234567", city: "Vilnius", about_me: null,
    experience_years: null, is_sitter: false, services: {}, prices: {}, avatar_url: null,
    verification_method: "none",
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ profile: h.profile, refresh: vi.fn() }) }));
vi.mock("@/hooks/useBusyDays", () => ({ useBusyDays: () => ({ busy: new Map(), reload: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/components/AccountData", () => ({ default: () => null }));
vi.mock("@/components/ImageUpload", () => ({ default: () => null }));

describe("/profile labels", () => {
  it.each([
    ["appPages.profile.fullNameLabel", "Ona P."],
    ["appPages.profile.cityLabel", "Vilnius"],
  ])("names the %s field through its label", (label, value) => {
    render(<ProfilePage />);
    expect(screen.getByLabelText(label)).toHaveValue(value);
  });

  it("names the sitter fields and the Sitter mode switch", async () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.profile.tabSitterSettings" }));
    // The tabs swap with an exit animation first, so the sitter panel arrives a moment later.
    const toggle = await screen.findByRole("switch", { name: "appPages.profile.sitterModeLabel" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByLabelText("appPages.profile.aboutMeLabel")).toBeInTheDocument();
    expect(screen.getByLabelText("appPages.profile.experienceLabel")).toBeInTheDocument();
  });
});
