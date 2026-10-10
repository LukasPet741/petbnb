import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupClient from "@/app/signup/SignupClient";
import LoginClient from "@/app/login/LoginClient";

/**
 * Signing up when the project asks for a confirmed email: Supabase answers with a user but no
 * session, so the page must say "check your email" instead of sending the visitor to a page
 * that needs a sign-in. Signing in before confirming offers to send the email again.
 * Rendered without a LanguageProvider: each string is its key.
 */

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  resend: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  signUp: h.signUp,
  signIn: h.signIn,
  resendSignupEmail: h.resend,
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: h.push }) }));
vi.mock("@/hooks/useRedirectIfSignedIn", () => ({ useRedirectIfSignedIn: () => {} }));
vi.mock("@/hooks/useNextPath", () => ({ useNextPath: () => null }));
vi.mock("@/components/SocialLogin", () => ({ default: () => null }));

beforeEach(() => {
  for (const fn of [h.signUp, h.signIn, h.resend, h.push]) fn.mockReset();
});

async function signUpAs(email: string) {
  const user = userEvent.setup();
  render(<SignupClient />);
  await user.type(screen.getByLabelText("auth.signup.form.emailLabel"), email);
  await user.type(screen.getByLabelText("auth.signup.form.passwordLabel"), "correct-horse-1");
  await user.type(screen.getByLabelText("auth.signup.form.confirmLabel"), "correct-horse-1");
  await user.click(screen.getByRole("button", { name: /common\.createAccount/ }));
  return user;
}

describe("signing up", () => {
  it("asks you to confirm your email when the account has no session yet", async () => {
    h.signUp.mockResolvedValue({ user: { id: "u1" }, session: null });
    await signUpAs("ruta@example.test");
    expect(await screen.findByRole("heading", { name: "auth.signup.checkEmail.title" })).toBeInTheDocument();
    expect(screen.getByText("ruta@example.test")).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
    // The form is gone: nothing left to submit twice.
    expect(screen.queryByRole("button", { name: /common\.createAccount/ })).toBeNull();
  });

  it("sends the email again when asked, and says so", async () => {
    h.signUp.mockResolvedValue({ user: { id: "u1" }, session: null });
    h.resend.mockResolvedValue(undefined);
    const user = await signUpAs("ruta@example.test");
    await user.click(await screen.findByRole("button", { name: "auth.signup.checkEmail.resend" }));
    expect(h.resend).toHaveBeenCalledWith("ruta@example.test");
    expect(await screen.findByText("auth.signup.checkEmail.resent")).toBeInTheDocument();
  });

  it("says why when the email cannot be sent again", async () => {
    h.signUp.mockResolvedValue({ user: { id: "u1" }, session: null });
    h.resend.mockRejectedValue(new Error("email rate limit exceeded"));
    const user = await signUpAs("ruta@example.test");
    await user.click(await screen.findByRole("button", { name: "auth.signup.checkEmail.resend" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("auth.knownErrors.rateLimited");
  });

  it("goes straight on to the profile when the account is signed in at once", async () => {
    h.signUp.mockResolvedValue({ user: { id: "u1" }, session: { access_token: "x" } });
    await signUpAs("ruta@example.test");
    await waitFor(() => expect(h.push).toHaveBeenCalledWith(expect.stringMatching(/^\/profile/)));
  });
});

describe("signing in before confirming", () => {
  it("offers to send the confirmation email again", async () => {
    h.signIn.mockRejectedValue(new Error("Email not confirmed"));
    h.resend.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginClient />);
    await user.type(screen.getByLabelText(/auth\.login\.form\.emailLabel|common\.email/), "ruta@example.test");
    await user.type(screen.getByLabelText(/auth\.login\.form\.passwordLabel|common\.password/), "correct-horse-1");
    await user.click(screen.getByRole("button", { name: /common\.signIn/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("auth.knownErrors.emailNotConfirmed");
    await user.click(screen.getByRole("button", { name: "auth.signup.checkEmail.resend" }));
    expect(h.resend).toHaveBeenCalledWith("ruta@example.test");
    expect(await screen.findByText("auth.signup.checkEmail.resent")).toBeInTheDocument();
  });
});
