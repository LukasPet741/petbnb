import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProfilePage from "@/app/(app)/profile/page";

/**
 * The phone field on /profile (Personal info): a Lithuania / Latvia / Estonia picker and a
 * national number. Until 2026-10-14 its `pattern` had lost its backslashes ("[ds-]{8,11}"),
 * so the browser refused every real number.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function.
 */

const h = vi.hoisted(() => ({ profileUpdate: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" }, session: {}, loading: false }) }));
// One object for every render: the page resets its form whenever `profile` changes identity.
const profileState = vi.hoisted(() => ({
  profile: {
    id: "me", full_name: "Lukas", phone: "" as string | null, city: "Vilnius", about_me: "", experience_years: null,
    is_sitter: false, services: {}, prices: {}, verification_method: "none", avatar_url: null,
  },
  loading: false,
  refresh: () => Promise.resolve(),
}));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => profileState, notifyProfileChanged: async () => {} }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/profile",
}));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn(), from: () => ({ update: h.profileUpdate }) },
}));
vi.mock("@/components/ImageUpload", () => ({ default: () => null }));

const country = () => screen.getByRole("combobox", { name: "appPages.profile.phoneCountryLabel" });
const number = () => screen.getByLabelText("appPages.profile.phoneLabel");
const save = () => fireEvent.submit(number().closest("form")!);
const savedPhone = () => h.profileUpdate.mock.calls[0]?.[0]?.phone;

beforeEach(() => {
  h.profileUpdate.mockReset();
  h.profileUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  profileState.profile = { ...profileState.profile, phone: "" };
});

describe("/profile phone", () => {
  it("saves a real Lithuanian number", async () => {
    render(<ProfilePage />);
    fireEvent.change(number(), { target: { value: "8 612 34567" } });
    save();
    await vi.waitFor(() => expect(savedPhone()).toBe("+370 61234567"));
  });

  it("saves a Latvian number when Latvia is picked", async () => {
    render(<ProfilePage />);
    fireEvent.change(country(), { target: { value: "LV" } });
    fireEvent.change(number(), { target: { value: "2123 4567" } });
    save();
    await vi.waitFor(() => expect(savedPhone()).toBe("+371 21234567"));
  });

  it("follows a pasted international number to its country", async () => {
    render(<ProfilePage />);
    fireEvent.change(number(), { target: { value: "+372 5123 4567" } });
    fireEvent.blur(number());
    expect(country()).toHaveValue("EE");
    expect(number()).toHaveValue("51234567");
    save();
    await vi.waitFor(() => expect(savedPhone()).toBe("+372 51234567"));
  });

  it("says what is wrong instead of saving a short number", async () => {
    render(<ProfilePage />);
    fireEvent.change(number(), { target: { value: "612 345" } });
    save();
    expect(await screen.findByText("appPages.profile.phoneInvalid.LT")).toBeInTheDocument();
    expect(h.profileUpdate).not.toHaveBeenCalled();
  });

  it("opens on the country of the stored number", () => {
    profileState.profile = { ...profileState.profile, phone: "+371 21234567" };
    render(<ProfilePage />);
    expect(country()).toHaveValue("LV");
    expect(number()).toHaveValue("21234567");
  });
});
