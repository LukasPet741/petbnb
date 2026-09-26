import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Sidebar from "@/components/Sidebar";
import { EMPTY_COLLAR_LIVE, type CollarLiveValue } from "@/context/CollarLiveContext";

/**
 * The app's primary navigation. Rendered without a LanguageProvider, so `t` is the identity
 * function and every accessible name is its translation key. Everything the sidebar reaches for
 * outside itself — router, profile, unread count, sign-out, the live collar — is mocked.
 */

const h = vi.hoisted(() => ({
  pathname: "/dashboard",
  unreadCount: 0,
  verified: false,
  collar: null as unknown as CollarLiveValue,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => h.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { full_name: "Rūta", avatar_url: null, is_verified: h.verified }, loading: false, isComplete: true, refresh: vi.fn() }),
}));
vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ({ unreadCount: h.unreadCount, notifications: [], loading: false, markRead: vi.fn(), markAllRead: vi.fn(), markThreadRead: vi.fn() }),
}));
vi.mock("@/context/CollarLiveContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/CollarLiveContext")>();
  return { ...actual, useCollarLive: () => h.collar };
});
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));

const LIVE_COLLAR: CollarLiveValue = {
  ...EMPTY_COLLAR_LIVE,
  collars: [{ id: "c1", label: "Reksas", is_demo: false, claimed_at: null, created_at: "2026-09-26T08:00:00Z", last_seen_at: "2026-09-26T11:59:58Z", gps_locked: true, gps_satellites: 7 }],
  selected: { id: "c1", label: "Reksas", is_demo: false, claimed_at: null, created_at: "2026-09-26T08:00:00Z", last_seen_at: "2026-09-26T11:59:58Z", gps_locked: true, gps_satellites: 7 },
  latest: { device_id: "c1", lat: 54.683, lng: 25.233, speed_kmh: 4.2, recorded_at: new Date().toISOString(), source: "collar" },
  // Live is derived from the newest real fix, so a live collar always has one.
  latestReal: { device_id: "c1", lat: 54.683, lng: 25.233, speed_kmh: 4.2, recorded_at: new Date().toISOString(), source: "collar" },
  state: "live",
};

const nav = () => screen.getAllByRole("navigation")[0];
const navHrefs = () => within(nav()).getAllByRole("link").map((a) => a.getAttribute("href"));
/** The desktop rail and the phone drawer share markup; the rail is the first match. */
const first = (name: RegExp) => screen.getAllByRole("link", { name })[0];

beforeEach(() => {
  h.pathname = "/dashboard";
  h.unreadCount = 0;
  h.verified = false;
  h.collar = EMPTY_COLLAR_LIVE;
});

describe("Sidebar navigation", () => {
  it("lists the app's sections in a deliberate order, legal no longer among them", () => {
    render(<Sidebar />);
    expect(navHrefs()).toEqual(["/dashboard", "/browse", "/pets", "/bookings", "/messages", "/saved", "/profile"]);
  });

  it("marks only the section you are actually in", () => {
    h.pathname = "/bookings";
    render(<Sidebar />);
    const current = within(nav()).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.getAttribute("href"));
    expect(current).toEqual(["/bookings"]);
  });

  it("drops the separate Find a sitter button (Browse is in the menu)", () => {
    render(<Sidebar />);
    expect(screen.queryByText("appShell.findASitter")).toBeNull();
  });
});

describe("Legal in the footer line", () => {
  it("links to legal from the footer, labelled from the dictionary", () => {
    render(<Sidebar />);
    expect(first(/appShell\.sidebar\.nav\.legal/).getAttribute("href")).toBe("/legal");
  });

  it("marks the legal link current on the privacy tab as well as the terms tab", () => {
    h.pathname = "/legal/privacy";
    render(<Sidebar />);
    expect(first(/nav\.legal/).getAttribute("aria-current")).toBe("page");
  });

  it("does not mark legal current while you are elsewhere", () => {
    render(<Sidebar />);
    expect(first(/nav\.legal/).getAttribute("aria-current")).toBeNull();
  });
});

describe("the collar and Smart-ID cards", () => {
  it("offers to pair a collar when there is none", () => {
    render(<Sidebar />);
    const card = first(/appShell\.spotlight\.pairTitle/);
    expect(card.getAttribute("href")).toBe("/collar");
  });

  it("shows the live collar with its name and the LIVE pill", () => {
    h.collar = LIVE_COLLAR;
    render(<Sidebar />);
    const card = first(/Reksas/);
    expect(card.getAttribute("href")).toBe("/collar");
    expect(within(card).getByText("appShell.spotlight.live")).toBeTruthy();
    expect(within(card).getByText("appShell.spotlight.lineLive")).toBeTruthy();
  });

  it("does not show a finished replay's end point as the collar's position (review I2)", () => {
    h.collar = {
      ...LIVE_COLLAR,
      latest: { device_id: "c1", lat: 54.68, lng: 25.23, speed_kmh: 4, recorded_at: new Date().toISOString(), source: "replay" },
      latestReal: null,
      state: "searching",
    };
    render(<Sidebar />);
    expect(first(/Reksas/).querySelector("[data-dot]")).toBeNull();
  });

  it("mutes the last real position while the collar is looking for satellites", () => {
    const real = { device_id: "c1", lat: 54.70, lng: 25.30, speed_kmh: 0, recorded_at: "2026-09-26T10:00:00Z", source: "collar" as const };
    h.collar = { ...LIVE_COLLAR, latest: real, latestReal: real, state: "searching" };
    render(<Sidebar />);
    const dot = first(/Reksas/).querySelector("[data-dot]");
    expect(dot).not.toBeNull();
    expect(dot!.querySelector(".animate-ping")).toBeNull();
  });

  it("says Smart-ID is not verified yet, and links to the demo", () => {
    render(<Sidebar />);
    const card = first(/appShell\.spotlight\.smartIdTitle/);
    expect(card.getAttribute("href")).toBe("/smart-id-demo");
    expect(within(card).getByText("appShell.spotlight.smartIdTodo")).toBeTruthy();
  });

  it("says the identity is verified, with the DEMO marker, once it is", () => {
    h.verified = true;
    render(<Sidebar />);
    const card = first(/appShell\.spotlight\.smartIdTitle/);
    expect(within(card).getByText("appShell.spotlight.smartIdVerified")).toBeTruthy();
    expect(within(card).getByText("appShell.spotlight.demo")).toBeTruthy();
  });

  it("ellipsizes the Smart-ID line rather than clipping it on a narrow rail", () => {
    // text-overflow works on a block, not on a flex container: the text needs its own span.
    render(<Sidebar />);
    const card = first(/appShell\.spotlight\.smartIdTitle/);
    const line = within(card).getByText("appShell.spotlight.smartIdTodo");
    expect(line.tagName).toBe("SPAN");
    expect(line.className).toContain("truncate");
  });

  it("lets the desktop rail scroll without a scrollbar taking the cards' width", () => {
    // Below ~800 px tall the rail scrolls; a 10 px Windows scrollbar clipped the LT Smart-ID line.
    render(<Sidebar />);
    expect(screen.getByRole("complementary").className).toContain("[scrollbar-width:none]");
  });

  it("puts a collar button in the phone's top bar", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "appShell.spotlight.collarButton" }).getAttribute("href")).toBe("/collar");
  });
});
