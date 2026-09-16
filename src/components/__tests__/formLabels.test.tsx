import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginClient from "@/app/login/LoginClient";
import SignupClient from "@/app/signup/SignupClient";

/**
 * Every field on the two account forms must be reachable by its label: tapping the label
 * focuses the input, and a screen reader reads the pair. Login and signup were written with
 * bare <label> elements, so their fields had no accessible name at all.
 *
 * Rendered without a LanguageProvider, so `t` returns the key and getByLabelText matches it.
 */

const h = vi.hoisted(() => ({
  auth: { user: null, session: null, loading: false },
  replace: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: h.replace, refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

beforeEach(() => {
  h.auth = { user: null, session: null, loading: false };
});

describe("login form", () => {
  it.each([
    ["auth.login.form.emailLabel"],
    ["auth.login.form.passwordLabel"],
  ])("names the %s field through its label", (label) => {
    render(<LoginClient />);
    expect(screen.getByLabelText(label)).toBeTruthy();
  });
});

describe("signup form", () => {
  it.each([
    ["auth.signup.form.emailLabel"],
    ["auth.signup.form.passwordLabel"],
    ["auth.signup.form.confirmLabel"],
  ])("names the %s field through its label", (label) => {
    render(<SignupClient />);
    expect(screen.getByLabelText(label)).toBeTruthy();
  });
});
