import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

/**
 * The session everyone reads, and the two ways it used to strand people:
 * - getSession() rejecting left `loading` true forever, so every page spun (found 2026-09-11).
 * - A password-reset link that Supabase sent to a page other than /reset-password (its Site URL
 *   fallback) signed the person in there and left them without the form (2026-09-15).
 */

type Listener = (event: string, session: unknown) => void;

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  listener: null as Listener | null,
  replace: vi.fn(),
  // The app router's instance is stable across renders; a fresh object each call would re-run
  // the provider's effect on every render.
  router: null as unknown,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => h.getSession(),
      onAuthStateChange: (cb: Listener) => {
        h.listener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => (h.router ??= { push: vi.fn(), replace: (...a: unknown[]) => h.replace(...a), refresh: vi.fn(), prefetch: vi.fn() }),
}));

function Probe() {
  const { user, loading } = useAuth();
  return <p>{loading ? "loading" : user ? "signed-in" : "signed-out"}</p>;
}

const visit = (url: string) => window.history.replaceState({}, "", url);

beforeEach(() => {
  h.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  h.listener = null;
  h.replace.mockReset();
});

afterEach(() => visit("/"));

describe("AuthProvider", () => {
  it("reports the stored session once it is read", async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("signed-in")).toBeTruthy());
  });

  it("stops loading and reports signed out when reading the session fails", async () => {
    h.getSession.mockRejectedValue(new Error("Failed to fetch"));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("signed-out")).toBeTruthy());
  });

  it("sends someone who arrived through a reset link on another page to /reset-password", async () => {
    visit("/");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(h.listener).not.toBeNull());
    act(() => h.listener!("PASSWORD_RECOVERY", { user: { id: "u1" } }));
    expect(h.replace).toHaveBeenCalledWith("/reset-password");
  });

  it("leaves them where they are when the link already landed on /reset-password", async () => {
    visit("/reset-password");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(h.listener).not.toBeNull());
    act(() => h.listener!("PASSWORD_RECOVERY", { user: { id: "u1" } }));
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("does not redirect on an ordinary sign-in", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(h.listener).not.toBeNull());
    act(() => h.listener!("SIGNED_IN", { user: { id: "u1" } }));
    expect(h.replace).not.toHaveBeenCalled();
  });
});
