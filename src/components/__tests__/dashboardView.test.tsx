import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import DashboardView, { type DashboardViewProps } from "@/components/dashboard/DashboardView";
import type { DashBooking } from "@/lib/dashboard";
import type { AppNotification } from "@/lib/types";

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
