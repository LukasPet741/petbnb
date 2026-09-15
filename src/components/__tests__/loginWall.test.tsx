import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AppLayout from "@/app/(app)/layout";
import LoginClient from "@/app/login/LoginClient";
import SignupClient from "@/app/signup/SignupClient";
import ProfilePage from "@/app/(app)/profile/page";

/**
 * The login wall remembers where a visitor was going.
 *
 * Since 2026-09-15 finding sitters needs an account, so the landing page's links all land
 * on the wall: "Find a groomer" → /browse?service=grooming → /login. Before this, the wall
 * always sent people to /dashboard after signing in, and sign-up dropped them on /profile,
 * so the choice they clicked was lost (a finding from the variant B review).
 *
 * Rendered without a LanguageProvider, so `t` is the identity function.
 */

const h = vi.hoisted(() => ({
  auth: { user: null, session: null, loading: false } as { user: unknown; session: unknown; loading: boolean },
  profile: { profile: null as unknown, loading: false, isComplete: false, refresh: vi.fn() },
  pathname: "/browse",
  replace: vi.fn(),
  push: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => h.profile }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => h.pathname,
}));
vi.mock("@/lib/auth", () => ({
  signIn: h.signIn,
  signUp: h.signUp,
  signOut: vi.fn(),
  matchAuthErrorKey: () => null,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }) },
}));
vi.mock("@/components/Sidebar", () => ({ default: () => null }));
vi.mock("@/components/CollarsPanel", () => ({ default: () => null }));
vi.mock("@/components/ImageUpload", () => ({ default: () => null }));
vi.mock("@/context/FavoritesContext", () => ({ FavoritesProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/context/NotificationsContext", () => ({ NotificationsProvider: ({ children }: { children: React.ReactNode }) => children }));

const SIGNED_IN = { user: { id: "u1" }, session: {}, loading: false };
const SIGNED_OUT = { user: null, session: null, loading: false };

/** Puts the tab at a URL, the way a visitor arriving from a link would be. */
const visit = (url: string) => window.history.replaceState({}, "", url);

beforeEach(() => {
  h.auth = SIGNED_OUT;
  h.profile = { profile: null, loading: false, isComplete: false, refresh: vi.fn() };
  h.pathname = "/browse";
  h.replace.mockReset();
  h.push.mockReset();
  h.signIn.mockReset().mockResolvedValue(undefined);
  h.signUp.mockReset().mockResolvedValue(undefined);
});

afterEach(() => visit("/"));

describe("the signed-in app shell", () => {
  it("sends a signed-out visitor to log in, remembering the filtered page they asked for", () => {
    visit("/browse?service=grooming");
    render(<AppLayout><p>page</p></AppLayout>);
    expect(h.replace).toHaveBeenCalledWith("/login?next=%2Fbrowse%3Fservice%3Dgrooming");
  });

  it("sends a signed-in visitor with an unfinished profile to finish it, still remembering the page", () => {
    h.auth = SIGNED_IN;
    h.pathname = "/browse/abc";
    visit("/browse/abc");
    render(<AppLayout><p>page</p></AppLayout>);
    expect(h.replace).toHaveBeenCalledWith("/profile?next=%2Fbrowse%2Fabc");
  });

  it("does not bounce someone already finishing their profile", () => {
    h.auth = SIGNED_IN;
    h.pathname = "/profile";
    visit("/profile?next=%2Fbrowse");
    render(<AppLayout><p>page</p></AppLayout>);
    expect(h.replace).not.toHaveBeenCalled();
  });
});

describe("/login", () => {
  it("continues to ?next= after signing in", async () => {
    visit("/login?next=%2Fbrowse%3Fservice%3Dgrooming");
    const { container } = render(<LoginClient />);
    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: "a@b.lt" } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "secret123" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/browse?service=grooming"));
  });

  it("goes to the dashboard after signing in when ?next= is missing or points off-site", async () => {
    visit("/login?next=%2F%2Fevil.example");
    const { container } = render(<LoginClient />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("sends someone already signed in straight on to ?next=", () => {
    h.auth = SIGNED_IN;
    visit("/login?next=%2Fbrowse");
    render(<LoginClient />);
    expect(h.replace).toHaveBeenCalledWith("/browse");
  });

  it("carries ?next= over to sign-up", () => {
    visit("/login?next=%2Fbrowse");
    render(<LoginClient />);
    expect(screen.getByRole("link", { name: "auth.login.createOneFree" })).toHaveAttribute("href", "/signup?next=%2Fbrowse");
  });
});

describe("/signup", () => {
  it("sends a new account to finish its profile, still carrying ?next=", async () => {
    visit("/signup?next=%2Fbrowse%3Fcity%3DKaunas");
    const { container } = render(<SignupClient />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/profile?next=%2Fbrowse%3Fcity%3DKaunas"));
  });

  it("carries ?next= over to log in", () => {
    visit("/signup?next=%2Fbrowse");
    render(<SignupClient />);
    expect(screen.getByRole("link", { name: "common.signIn" })).toHaveAttribute("href", "/login?next=%2Fbrowse");
  });
});

describe("/profile", () => {
  it("continues to ?next= once the profile is saved", async () => {
    h.auth = SIGNED_IN;
    visit("/profile?next=%2Fbrowse%3Fservice%3Dwalking");
    const { container } = render(<ProfilePage />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/browse?service=walking"));
  });

  it("stays put after saving when there is nowhere to continue to", async () => {
    h.auth = SIGNED_IN;
    visit("/profile");
    const { container } = render(<ProfilePage />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(h.profile.refresh).toHaveBeenCalled());
    expect(h.push).not.toHaveBeenCalled();
  });
});
