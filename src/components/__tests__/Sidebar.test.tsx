import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Sidebar from "@/components/Sidebar";

/**
 * The app's primary navigation, and until now untested.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function and each link's
 * accessible name is the translation key it asked for. Everything the sidebar reaches
 * for outside itself — the router, the signed-in profile, the unread count, sign-out —
 * is mocked; none of it is what these tests are about.
 */

const h = vi.hoisted(() => ({ pathname: "/dashboard", unreadCount: 0 }));

vi.mock("next/navigation", () => ({
  usePathname: () => h.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { full_name: "Rūta", avatar_url: null }, loading: false, isComplete: true, refresh: vi.fn() }),
}));
vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ({ unreadCount: h.unreadCount, notifications: [], loading: false, markRead: vi.fn(), markAllRead: vi.fn(), markThreadRead: vi.fn() }),
}));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));

/** The nav element, so the CTA and header links below it are not counted. */
const nav = () => screen.getAllByRole("navigation")[0];
const navHrefs = () =>
  within(nav())
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"));

beforeEach(() => {
  h.pathname = "/dashboard";
  h.unreadCount = 0;
});

describe("Sidebar navigation", () => {
  it("lists the app's sections in a deliberate order", () => {
    render(<Sidebar />);
    expect(navHrefs()).toEqual([
      "/dashboard",
      "/browse",
      "/pets",
      "/bookings",
      "/messages",
      "/saved",
      "/profile",
      "/legal",
    ]);
  });

  it("puts legal last, below everything a person came here to do", () => {
    // It is reference material, not a destination — it belongs at the bottom, and it
    // must not push a working link out of reach on a short screen.
    render(<Sidebar />);
    const hrefs = navHrefs();
    expect(hrefs[hrefs.length - 1]).toBe("/legal");
  });

  it("labels the legal link from the dictionary", () => {
    render(<Sidebar />);
    expect(within(nav()).getByRole("link", { name: /appShell\.sidebar\.nav\.legal/ })).toBeTruthy();
  });

  it("marks the legal link current on the privacy tab as well as the terms tab", () => {
    // /legal redirects to /legal/terms, and the two documents are tabs of one page.
    // Highlighting only on /legal/terms would make Privacy look like it left the app.
    h.pathname = "/legal/privacy";
    render(<Sidebar />);
    const legal = within(nav()).getByRole("link", { name: /nav\.legal/ });
    expect(legal.getAttribute("aria-current")).toBe("page");
  });

  it("marks only the section you are actually in", () => {
    h.pathname = "/bookings";
    render(<Sidebar />);
    const current = within(nav())
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page")
      .map((a) => a.getAttribute("href"));
    expect(current).toEqual(["/bookings"]);
  });

  it("does not mark legal current while you are elsewhere", () => {
    h.pathname = "/dashboard";
    render(<Sidebar />);
    const legal = within(nav()).getByRole("link", { name: /nav\.legal/ });
    expect(legal.getAttribute("aria-current")).toBeNull();
  });
});
