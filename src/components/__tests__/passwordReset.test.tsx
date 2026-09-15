import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginClient from "@/app/login/LoginClient";
import ForgotPasswordClient from "@/app/forgot-password/ForgotPasswordClient";
import ResetPasswordClient from "@/app/reset-password/ResetPasswordClient";

/**
 * Forgot password (Lukas, 2026-09-15): login links to /forgot-password, which asks Supabase to
 * mail a link; the link signs the person in for recovery and lands on /reset-password, where
 * they choose a new password.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function and each label is the
 * translation key it asked for.
 */

const h = vi.hoisted(() => ({
  auth: { user: null, session: null, loading: false } as { user: unknown; session: unknown; loading: boolean },
  push: vi.fn(),
  replace: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  signIn: vi.fn(),
  requestPasswordReset: h.requestPasswordReset,
  updatePassword: h.updatePassword,
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const SIGNED_IN = { user: { id: "u1" }, session: {}, loading: false };
const SIGNED_OUT = { user: null, session: null, loading: false };
const LOADING = { user: null, session: null, loading: true };

beforeEach(() => {
  h.auth = SIGNED_OUT;
  h.push.mockReset();
  h.replace.mockReset();
  h.requestPasswordReset.mockReset().mockResolvedValue(undefined);
  h.updatePassword.mockReset().mockResolvedValue(undefined);
});

describe("login page", () => {
  it("links to the forgot-password page", () => {
    render(<LoginClient />);
    expect(screen.getByRole("link", { name: "auth.login.forgotPassword" }).getAttribute("href")).toBe("/forgot-password");
  });
});

describe("forgot-password page", () => {
  const submit = (email: string) => {
    fireEvent.change(screen.getByLabelText("auth.forgot.emailLabel"), { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: /auth\.forgot\.submit/ }));
  };

  it("sends the reset link to the address typed and then says so without confirming the account exists", async () => {
    render(<ForgotPasswordClient />);
    submit("owner@example.com");
    await waitFor(() => expect(screen.getByText("auth.forgot.sentTitle")).toBeTruthy());
    expect(h.requestPasswordReset).toHaveBeenCalledWith("owner@example.com");
    expect(screen.getByText("auth.forgot.sentBody")).toBeTruthy();
    expect(screen.queryByLabelText("auth.forgot.emailLabel")).toBeNull();
  });

  it("explains a rate limit instead of pretending the mail went out", async () => {
    h.requestPasswordReset.mockRejectedValue(new Error("For security purposes, you can only request this after 42 seconds."));
    render(<ForgotPasswordClient />);
    submit("owner@example.com");
    await waitFor(() => expect(screen.getByText("auth.knownErrors.rateLimited")).toBeTruthy());
    expect(screen.queryByText("auth.forgot.sentTitle")).toBeNull();
    expect(screen.getByLabelText("auth.forgot.emailLabel")).toBeTruthy();
  });

  it("falls back to a generic error for anything unrecognised", async () => {
    h.requestPasswordReset.mockRejectedValue(new Error("Failed to fetch"));
    render(<ForgotPasswordClient />);
    submit("owner@example.com");
    await waitFor(() => expect(screen.getByText("auth.forgot.errorFallback")).toBeTruthy());
  });

  it("offers a way back to sign in", () => {
    render(<ForgotPasswordClient />);
    expect(screen.getByRole("link", { name: "auth.forgot.backToLogin" }).getAttribute("href")).toBe("/login");
  });
});

describe("reset-password page", () => {
  const fill = (password: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText("auth.reset.passwordLabel"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("auth.reset.confirmLabel"), { target: { value: confirm } });
    fireEvent.click(screen.getByRole("button", { name: /auth\.reset\.submit/ }));
  };

  it("shows neither the form nor the expired notice while the link is still being read", () => {
    h.auth = LOADING;
    render(<ResetPasswordClient />);
    expect(screen.queryByLabelText("auth.reset.passwordLabel")).toBeNull();
    expect(screen.queryByText("auth.reset.expiredTitle")).toBeNull();
  });

  it("treats a visit with no recovery session as an expired or used link and offers a new one", () => {
    render(<ResetPasswordClient />);
    expect(screen.getByText("auth.reset.expiredTitle")).toBeTruthy();
    expect(screen.queryByLabelText("auth.reset.passwordLabel")).toBeNull();
    expect(screen.getByRole("link", { name: "auth.reset.requestNew" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("asks for the new password twice, at least 8 characters", () => {
    h.auth = SIGNED_IN;
    render(<ResetPasswordClient />);
    expect(screen.getByLabelText("auth.reset.passwordLabel").getAttribute("minlength")).toBe("8");
    expect(screen.getByLabelText("auth.reset.passwordLabel").getAttribute("autocomplete")).toBe("new-password");
    expect(screen.getByLabelText("auth.reset.confirmLabel")).toBeTruthy();
  });

  it("does not save when the two passwords differ", async () => {
    h.auth = SIGNED_IN;
    render(<ResetPasswordClient />);
    fill("new-password-1", "new-password-2");
    await waitFor(() => expect(screen.getByText("auth.signup.passwordMismatch")).toBeTruthy());
    expect(h.updatePassword).not.toHaveBeenCalled();
  });

  it("saves the new password and then offers the dashboard", async () => {
    h.auth = SIGNED_IN;
    render(<ResetPasswordClient />);
    fill("new-password-1", "new-password-1");
    await waitFor(() => expect(screen.getByText("auth.reset.doneTitle")).toBeTruthy());
    expect(h.updatePassword).toHaveBeenCalledWith("new-password-1");
    expect(screen.getByRole("link", { name: /auth\.reset\.continue/ }).getAttribute("href")).toBe("/dashboard");
  });

  it("says so when the new password is the old one", async () => {
    h.auth = SIGNED_IN;
    h.updatePassword.mockRejectedValue(new Error("New password should be different from the old password."));
    render(<ResetPasswordClient />);
    fill("old-password", "old-password");
    await waitFor(() => expect(screen.getByText("auth.knownErrors.samePassword")).toBeTruthy());
    expect(screen.queryByText("auth.reset.doneTitle")).toBeNull();
  });

  it("switches to the expired notice when the recovery session is gone by the time they save", async () => {
    h.auth = SIGNED_IN;
    h.updatePassword.mockRejectedValue(new Error("Auth session missing!"));
    render(<ResetPasswordClient />);
    fill("new-password-1", "new-password-1");
    await waitFor(() => expect(screen.getByText("auth.reset.expiredTitle")).toBeTruthy());
    expect(screen.queryByLabelText("auth.reset.passwordLabel")).toBeNull();
  });
});
