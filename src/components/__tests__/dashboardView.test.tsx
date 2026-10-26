import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import DashboardView, { type DashboardViewProps } from "@/components/dashboard/DashboardView";
import type { DashBooking } from "@/lib/dashboard";
import type { AppNotification } from "@/lib/types";
import type { OnboardingStep } from "@/lib/sitter-onboarding";

// The real hook reads the places tables over the network; here it is the built-in list.
vi.mock("@/lib/useSitterAreas", () => ({ useSitterAreas: () => [] }));
vi.mock("@/lib/usePlaces", async () => {
  const { ALL_PLACES } = await import("@/lib/partners");
  return { usePlaces: () => ALL_PLACES };
});

/**
 * Dashboard variant A (2026-09-15): one hero card for what needs the visitor next, the latest
 * notifications grouped by day, and a side column with what is waiting on an answer.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function and every label is the
 * key it asked for.
 */

const NOW = Date.parse("2026-09-15T08:00:00+03:00");

const booking: DashBooking = {
  id: "bk-1",
  status: "signed",
  service: "walking",
  start_at: new Date("2026-09-16T09:00:00+03:00").toISOString(),
  end_at: new Date("2026-09-16T10:00:00+03:00").toISOString(),
  pet: { id: "p1", name: "Rudis", photo_url: null, type: "dog" },
  counterpart: { id: "u2", full_name: "Emilija A.", avatar_url: null },
};

const note = (over: Partial<AppNotification>): AppNotification =>
  ({
    id: "n1",
    user_id: "me",
    actor_id: "u2",
    booking_id: "bk-1",
    type: "booking_accepted",
    read_at: null,
    created_at: new Date("2026-09-15T07:00:00+03:00").toISOString(),
    email_status: "sent",
    email_error: null,
    actor: { id: "u2", full_name: "Emilija A.", avatar_url: null },
    ...over,
  }) as AppNotification;

const props = (over: Partial<DashboardViewProps> = {}): DashboardViewProps => ({
  firstName: "Lukas",
  now: NOW,
  hero: { kind: "next", booking, role: "owner" },
  waiting: [],
  pets: [{ id: "p1", name: "Rudis", type: "dog", photo_url: null }],
  savedCount: 3,
  notifications: [],
  notificationsLoading: false,
  unreadCount: 0,
  onMarkAllRead: vi.fn(),
  onOpenNotification: vi.fn(),
  ...over,
});

const hrefOf = (name: string | RegExp) => screen.getByRole("link", { name }).getAttribute("href");

describe("hero card", () => {
  it("shows the next confirmed booking with a way to message the other person and see the booking", () => {
    render(<DashboardView {...props()} />);
    expect(screen.getByText("appShell.dashboard.hero.nextLabel")).toBeInTheDocument();
    expect(screen.getByText("appShell.dashboard.hero.tomorrow")).toBeInTheDocument();
    expect(screen.getByText("appShell.dashboard.hero.roleSitter")).toBeInTheDocument();
    expect(hrefOf("appShell.dashboard.hero.message")).toBe("/messages/bk-1");
    expect(hrefOf("appShell.dashboard.hero.details")).toBe("/bookings");
  });

  it("asks a sitter to answer a request, and says how many are waiting", () => {
    render(<DashboardView {...props({ hero: { kind: "answer", booking: { ...booking, status: "pending" }, count: 2 } })} />);
    expect(screen.getByText("appShell.dashboard.hero.answerLabel")).toBeInTheDocument();
    expect(screen.getByText("appShell.dashboard.hero.roleOwner")).toBeInTheDocument();
    expect(screen.getByText(/appShell\.dashboard\.hero\.moreRequests\./)).toBeInTheDocument();
    expect(hrefOf("appShell.dashboard.hero.answer")).toBe("/bookings");
  });

  it("offers adding a pet before searching when there is nothing booked and no pet yet", () => {
    render(<DashboardView {...props({ hero: { kind: "empty" }, pets: [] })} />);
    expect(screen.getByText("appShell.dashboard.hero.emptyTitle")).toBeInTheDocument();
    expect(hrefOf("appShell.dashboard.hero.addPet")).toBe("/pets/new");
  });
});

describe("latest notifications", () => {
  const notifications = [
    note({ id: "today-unread" }),
    note({ id: "yesterday-read", type: "booking_requested", read_at: "2026-09-14T12:00:00Z", created_at: new Date("2026-09-14T10:00:00+03:00").toISOString() }),
  ];

  it("groups rows under today and earlier, each linking to its conversation", () => {
    render(<DashboardView {...props({ notifications, unreadCount: 1 })} />);
    const feed = screen.getByRole("region", { name: "appShell.dashboard.feed.heading" });
    expect(within(feed).getByText("appShell.dashboard.feed.today")).toBeInTheDocument();
    expect(within(feed).getByText("appShell.dashboard.feed.earlier")).toBeInTheDocument();
    expect(within(feed).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/messages/bk-1", "/messages/bk-1"]);
  });

  it("marks a row read when it is opened, and offers mark-all only while something is unread", () => {
    const onOpenNotification = vi.fn();
    const onMarkAllRead = vi.fn();
    const { rerender } = render(<DashboardView {...props({ notifications, unreadCount: 1, onOpenNotification, onMarkAllRead })} />);

    const row = screen.getAllByRole("link", { name: /messages\.notifications\.booking_accepted/ })[0];
    row.addEventListener("click", (e) => e.preventDefault()); // jsdom cannot navigate
    fireEvent.click(row);
    expect(onOpenNotification).toHaveBeenCalledWith(expect.objectContaining({ id: "today-unread" }));

    fireEvent.click(screen.getByRole("button", { name: "messages.notifications.markAllRead" }));
    expect(onMarkAllRead).toHaveBeenCalled();

    rerender(<DashboardView {...props({ notifications, unreadCount: 0 })} />);
    expect(screen.queryByRole("button", { name: "messages.notifications.markAllRead" })).not.toBeInTheDocument();
  });

  it("says so when there is nothing yet", () => {
    render(<DashboardView {...props()} />);
    expect(screen.getByText("messages.notifications.empty")).toBeInTheDocument();
  });
});

describe("side column", () => {
  it("lists what waits on an answer, telling apart the visitor's turn from the sitter's", () => {
    render(
      <DashboardView
        {...props({
          waiting: [
            { booking: { ...booking, id: "mine-to-answer", status: "pending" }, role: "sitter" },
            { booking: { ...booking, id: "sent-by-me", status: "pending" }, role: "owner" },
          ],
        })}
      />,
    );
    const waiting = screen.getByRole("region", { name: "appShell.dashboard.waiting.heading" });
    expect(within(waiting).getByText("appShell.dashboard.waiting.yours")).toBeInTheDocument();
    expect(within(waiting).getByText("appShell.dashboard.waiting.theirs")).toBeInTheDocument();
  });

  it("links the pets and the saved sitters", () => {
    render(<DashboardView {...props()} />);
    expect(screen.getByRole("link", { name: /Rudis/ })).toHaveAttribute("href", "/pets");
    expect(screen.getByRole("link", { name: /appShell\.dashboard\.saved\.heading/ })).toHaveAttribute("href", "/saved");
  });
});

describe("onboarding ring", () => {
  const steps: OnboardingStep[] = [
    { key: "photo", done: true, href: "/profile" },
    { key: "bio", done: false, href: "/profile" },
    { key: "services", done: true, href: "/profile" },
    { key: "prices", done: true, href: "/profile" },
    { key: "verified", done: false, href: "/smart-id-demo" },
  ];
  const RING = { name: "appShell.dashboard.onboarding.title" };

  it("shows a sitter how far along they are and links each missing step", () => {
    render(<DashboardView {...props({ onboarding: steps })} />);
    expect(screen.getByRole("progressbar", RING)).toHaveAttribute("aria-valuenow", "60");
    expect(hrefOf("appShell.dashboard.onboarding.steps.verified")).toBe("/smart-id-demo");
    expect(hrefOf("appShell.dashboard.onboarding.steps.bio")).toBe("/profile");
  });

  it("does not link steps that are already done", () => {
    render(<DashboardView {...props({ onboarding: steps })} />);
    expect(screen.getByText("appShell.dashboard.onboarding.steps.photo").closest("a")).toBeNull();
  });

  it("disappears once everything is done, and for anyone who is not a sitter", () => {
    const { rerender } = render(<DashboardView {...props({ onboarding: steps.map((s) => ({ ...s, done: true })) })} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    rerender(<DashboardView {...props({ onboarding: null })} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    rerender(<DashboardView {...props()} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

/**
 * Night Forest (2026-10-24): a deep Today band with the visitor's numbers, a request answered
 * on the lead card itself, and the week ahead.
 */
describe("today band", () => {
  it("greets the visitor by name in the page's one h1", () => {
    render(<DashboardView {...props()} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Lukas");
  });

  it("says how many requests wait on an answer, and that nothing does when nothing does", () => {
    const { rerender } = render(<DashboardView {...props({ hero: { kind: "answer", booking: { ...booking, status: "pending" }, count: 2 } })} />);
    expect(screen.getByText(/appShell\.dashboard\.today\.toAnswer\./)).toBeInTheDocument();
    rerender(<DashboardView {...props()} />);
    expect(screen.getByText("appShell.dashboard.today.allClear")).toBeInTheDocument();
  });

  it("shows the numbers once there is something to count, and not before", () => {
    const { rerender } = render(<DashboardView {...props({ stats: { rating: { average: 4.7, count: 3 }, completed: 3, upcoming: 2 } })} />);
    const numbers = screen.getByLabelText("appShell.dashboard.today.stats.label");
    expect(numbers.tagName).toBe("DL");
    expect(within(numbers).getByText("appShell.dashboard.today.stats.completed")).toBeInTheDocument();
    expect(within(numbers).getByText("appShell.dashboard.today.stats.upcoming")).toBeInTheDocument();

    rerender(<DashboardView {...props({ stats: { rating: null, completed: 0, upcoming: 0 } })} />);
    expect(screen.queryByText("appShell.dashboard.today.stats.completed")).not.toBeInTheDocument();
  });
});

describe("answering on the lead card", () => {
  const request = { kind: "answer" as const, booking: { ...booking, status: "pending", notes: "Vėjas loves long walks." }, count: 1 };
  const answer = (over: Partial<NonNullable<DashboardViewProps["answer"]>> = {}) => ({
    priceLine: "common.pricing.asking",
    canAccept: true,
    acceptLabel: "appPages.bookings.acceptForButton",
    waitingLabel: null,
    busy: false,
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    ...over,
  });

  it("accepts at the price on the table and declines, right on the card", () => {
    const a = answer();
    render(<DashboardView {...props({ hero: request, answer: a })} />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.bookings.acceptForButton" }));
    expect(a.onAccept).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "appPages.bookings.declineButton" }));
    expect(a.onDecline).toHaveBeenCalled();
  });

  it("sends a counter-offer to the chat, where offers are made", () => {
    render(<DashboardView {...props({ hero: request, answer: answer() })} />);
    expect(hrefOf("appShell.dashboard.hero.counter")).toBe("/messages/bk-1");
  });

  it("quotes what the owner wrote and shows the price on the table", () => {
    render(<DashboardView {...props({ hero: request, answer: answer() })} />);
    expect(screen.getByText("“Vėjas loves long walks.”")).toBeInTheDocument();
    expect(screen.getByText("common.pricing.asking")).toBeInTheDocument();
  });

  it("offers no accept when the sitter is waiting on the owner's reply, and says so", () => {
    render(<DashboardView {...props({ hero: request, answer: answer({ canAccept: false, acceptLabel: undefined, waitingLabel: "appPages.bookings.waitingForOwner" }) })} />);
    expect(screen.queryByRole("button", { name: "appPages.bookings.acceptForButton" })).not.toBeInTheDocument();
    expect(screen.getByText("appPages.bookings.waitingForOwner")).toBeInTheDocument();
  });

  it("holds the buttons while a write is in flight", () => {
    render(<DashboardView {...props({ hero: request, answer: answer({ busy: true }) })} />);
    expect(screen.getByRole("button", { name: "appPages.bookings.acceptForButton" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "appPages.bookings.declineButton" })).toBeDisabled();
  });
});

describe("coming up", () => {
  const later = { ...booking, id: "bk-later", start_at: new Date("2026-09-17T09:00:00+03:00").toISOString(), end_at: new Date("2026-09-17T18:00:00+03:00").toISOString() };
  const over = { ...booking, id: "bk-over", start_at: new Date("2026-09-14T09:00:00+03:00").toISOString(), end_at: new Date("2026-09-14T10:00:00+03:00").toISOString() };

  it("lists the bookings ahead, each opening its conversation, with whose pet it is", () => {
    render(<DashboardView {...props({ agenda: [{ booking: later, role: "sitter" }] })} />);
    const card = screen.getByRole("region", { name: "appShell.dashboard.agenda.heading" });
    expect(within(card).getByRole("link", { name: /appShell\.dashboard\.agenda\.youSit/ })).toHaveAttribute("href", "/messages/bk-later");
  });

  it("asks a sitter to mark a finished booking completed", () => {
    const onMarkDone = vi.fn();
    render(<DashboardView {...props({ toFinish: [over], onMarkDone })} />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.bookings.markCompletedButton" }));
    expect(onMarkDone).toHaveBeenCalledWith(expect.objectContaining({ id: "bk-over" }));
  });

  it("draws the next seven days and says when nothing is booked", () => {
    render(<DashboardView {...props()} />);
    const week = screen.getByRole("list", { name: "appShell.dashboard.agenda.weekLabel" });
    expect(within(week).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("appShell.dashboard.agenda.empty")).toBeInTheDocument();
  });
});
