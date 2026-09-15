import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PublicHeader from "@/components/PublicHeader";
import LegalLayout from "@/app/legal/layout";
import LoginClient from "@/app/login/LoginClient";
import SignupClient from "@/app/signup/SignupClient";

/**
 * A signed-in visitor on a public page must never be shown the signed-out site.
 *
 * Found 2026-09-15: sidebar Legal → "Back to home" landed on `/`, which offered
 * "Sign in" and "Get started" to someone whose session was intact, so reading the
 * policy looked exactly like being logged out. Every public page was auth-blind.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function and each
 * label is the translation key it asked for.
 */

const h = vi.hoisted(() => ({
  sitterId: "740b5962-4f41-4871-9c4e-333d7680325b",
  auth: { user: null, session: null, loading: false } as { user: unknown; session: unknown; loading: boolean },
  replace: vi.fn(),
  push: vi.fn(),
}));

const SIGNED_IN = { user: { id: "u1" }, session: {}, loading: false };
const SIGNED_OUT = { user: null, session: null, loading: false };
const LOADING = { user: null, session: null, loading: true };

vi.mock("@/context/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: h.sitterId }),
  useSelectedLayoutSegment: () => "terms",
}));
vi.mock("@/lib/supabase", () => {
  const sitter = { id: h.sitterId, full_name: "Emilija Ambrazevičiūtė", is_sitter: true, services: { walking: true }, rate_per_hour: 26 };
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: sitter, error: null }),
  };
  return { supabase: { from: () => chain } };
});
vi.mock("@/components/RatingSummary", () => ({ default: () => null }));
vi.mock("@/components/ReviewList", () => ({ default: () => null }));

beforeEach(() => {
  h.auth = SIGNED_OUT;
  h.replace.mockReset();
  h.push.mockReset();
});

const hrefs = (root: HTMLElement = document.body) =>
  within(root).queryAllByRole("link").map((a) => a.getAttribute("href"));

describe("legal pages", () => {
  it("send a signed-out reader back to the landing page", () => {
    render(<LegalLayout><p>doc</p></LegalLayout>);
    expect(screen.getByRole("link", { name: /legal\.backLink/ })).toHaveAttribute("href", "/");
  });

  it("send a signed-in reader back to the dashboard, never to the landing page", () => {
    h.auth = SIGNED_IN;
    render(<LegalLayout><p>doc</p></LegalLayout>);
    expect(screen.getByRole("link", { name: /legal\.backToDashboard/ })).toHaveAttribute("href", "/dashboard");
    expect(hrefs()).not.toContain("/");
  });
});

describe("public header", () => {
  it("offers sign in and sign up when signed out", () => {
    render(<PublicHeader />);
    expect(hrefs()).toEqual(expect.arrayContaining(["/login", "/signup"]));
    expect(hrefs()).not.toContain("/dashboard");
  });

  it("offers the dashboard instead of sign in and sign up when signed in", () => {
    h.auth = SIGNED_IN;
    render(<PublicHeader />);
    expect(screen.getByRole("link", { name: /common\.dashboard/ })).toHaveAttribute("href", "/dashboard");
    expect(hrefs()).not.toContain("/login");
    expect(hrefs()).not.toContain("/signup");
  });
});

describe.each([
  ["login", LoginClient],
  ["signup", SignupClient],
])("/%s", (_name, Page) => {
  it("sends someone already signed in to the dashboard", () => {
    h.auth = SIGNED_IN;
    render(<Page />);
    expect(h.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("leaves a signed-out visitor on the form", () => {
    render(<Page />);
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("does not decide while the session is still loading", () => {
    h.auth = LOADING;
    render(<Page />);
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("does not take over once the visitor signs in on this page", () => {
    // The form navigates on its own after a successful submit (signup to /profile).
    // A redirect that fired on the session appearing would race it.
    const { rerender } = render(<Page />);
    h.auth = SIGNED_IN;
    rerender(<Page />);
    expect(h.replace).not.toHaveBeenCalled();
  });
});
