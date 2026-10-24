import type { AppNotification } from "@/lib/types";
import { averageRating } from "@/lib/reviews";

/**
 * What the dashboard leads with (variant A, 2026-09-15).
 *
 * The research behind it: a personal dashboard should open on the one thing that needs the
 * visitor now and keep everything else a glance away. For petbnb that order is — a request
 * the visitor must answer as a sitter, then their soonest confirmed booking on either side,
 * then their own request still waiting on a sitter, then nothing.
 */

export interface DashBooking {
  id: string;
  status: string;
  service: string;
  start_at: string;
  end_at: string;
  pet: { id: string; name: string; photo_url: string | null; type: string } | null;
  /** The other person: the sitter on the visitor's own bookings, the owner on bookings for them. */
  counterpart: { id: string; full_name: string | null; avatar_url: string | null } | null;
  /** What the owner wrote with the request; the lead card quotes it to the sitter. */
  notes?: string | null;
  /** Price and parties, which the lead card needs to answer a request where it stands. */
  asking_price?: number | null;
  agreed_price?: number | null;
  owner_id?: string;
  sitter_id?: string;
}

export type Role = "owner" | "sitter";

export type Hero =
  | { kind: "answer"; booking: DashBooking; count: number }
  | { kind: "next"; booking: DashBooking; role: Role }
  | { kind: "awaiting"; booking: DashBooking; count: number }
  | { kind: "empty" };

interface Sides {
  owner: DashBooking[];
  sitter: DashBooking[];
  now: number;
}

const upcoming = (list: DashBooking[], status: string, now: number) =>
  list
    .filter((b) => b.status === status && Date.parse(b.start_at) > now)
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));

export function pickHero({ owner, sitter, now }: Sides): Hero {
  const toAnswer = upcoming(sitter, "pending", now);
  if (toAnswer.length > 0) return { kind: "answer", booking: toAnswer[0], count: toAnswer.length };

  const confirmed = [
    ...upcoming(owner, "signed", now).map((booking) => ({ booking, role: "owner" as const })),
    ...upcoming(sitter, "signed", now).map((booking) => ({ booking, role: "sitter" as const })),
  ].sort((a, b) => Date.parse(a.booking.start_at) - Date.parse(b.booking.start_at));
  if (confirmed.length > 0) return { kind: "next", ...confirmed[0] };

  const awaiting = upcoming(owner, "pending", now);
  if (awaiting.length > 0) return { kind: "awaiting", booking: awaiting[0], count: awaiting.length };

  return { kind: "empty" };
}

/** Live pending requests on both sides that the hero does not already show, soonest first. */
export function waitingList({ owner, sitter, hero, now }: Sides & { hero: Hero }): { booking: DashBooking; role: Role }[] {
  const shown = hero.kind === "empty" ? null : hero.booking.id;
  return [
    ...upcoming(sitter, "pending", now).map((booking) => ({ booking, role: "sitter" as const })),
    ...upcoming(owner, "pending", now).map((booking) => ({ booking, role: "owner" as const })),
  ]
    .filter((item) => item.booking.id !== shown)
    .sort((a, b) => Date.parse(a.booking.start_at) - Date.parse(b.booking.start_at))
    .slice(0, 3);
}

/**
 * A booking's day as people say it — "rugsėjo 18 d.", "18 September" — for the dashboard.
 * formatDate() is the wrong tool here: its Lithuanian short form is "2026-09-18".
 */
export function dayLabel(iso: string, locale: "en" | "lt"): string {
  return new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { month: "long", day: "numeric" }).format(new Date(iso));
}

export const dayKey = (ms: number) => new Date(ms).toDateString();

/**
 * The newest `limit` notifications split into today and earlier, by the visitor's own calendar
 * day. The feed is for scanning, and time groups are what make a feed scannable.
 */
export function groupByDay(
  notifications: AppNotification[],
  now: number,
  limit = 6,
): { today: AppNotification[]; earlier: AppNotification[] } {
  const today: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  for (const n of notifications.slice(0, limit)) {
    (dayKey(Date.parse(n.created_at)) === dayKey(now) ? today : earlier).push(n);
  }
  return { today, earlier };
}

/**
 * Confirmed bookings still ahead, on both sides, soonest first: the "Coming up" card (Night
 * Forest, 2026-10-24). The lead card's own booking is left out so it is not said twice.
 */
export function agendaList({ owner, sitter, now }: Sides, skipId: string | null = null, limit = 3): { booking: DashBooking; role: Role }[] {
  return [
    ...upcoming(owner, "signed", now).map((booking) => ({ booking, role: "owner" as const })),
    ...upcoming(sitter, "signed", now).map((booking) => ({ booking, role: "sitter" as const })),
  ]
    .filter((item) => item.booking.id !== skipId)
    .sort((a, b) => Date.parse(a.booking.start_at) - Date.parse(b.booking.start_at))
    .slice(0, limit);
}

/** The days of the next week that hold a confirmed booking, and on which side, for the week strip. */
export function bookedDays({ owner, sitter, now }: Sides): Map<string, Role> {
  const days = new Map<string, Role>();
  const horizon = now + 7 * 86_400_000;
  for (const [list, role] of [[owner, "owner"], [sitter, "sitter"]] as const) {
    for (const b of upcoming(list, "signed", now)) {
      if (Date.parse(b.start_at) < horizon && !days.has(dayKey(Date.parse(b.start_at)))) days.set(dayKey(Date.parse(b.start_at)), role);
    }
  }
  return days;
}

/**
 * A sitter's confirmed bookings whose time is over but that nobody marked done. Until they are,
 * the owner cannot leave a review, so the dashboard asks rather than waiting for a visit to
 * the bookings page. Most recently ended first.
 */
export function toFinishList(sitter: DashBooking[], now: number, limit = 2): DashBooking[] {
  return sitter
    .filter((b) => b.status === "signed" && Date.parse(b.end_at) <= now)
    .sort((a, b) => Date.parse(b.end_at) - Date.parse(a.end_at))
    .slice(0, limit);
}

export interface DashStats {
  /** The visitor's average across every review written about them, either direction. */
  rating: { average: number; count: number } | null;
  completed: number;
  upcoming: number;
}

/** The numbers on the Today band, from the same two booking lists the rest of the page uses. */
export function dashboardStats({ owner, sitter, now }: Sides, ratings: number[]): DashStats {
  const all = [...owner, ...sitter];
  const average = averageRating(ratings);
  return {
    rating: average === null ? null : { average, count: ratings.length },
    completed: all.filter((b) => b.status === "completed").length,
    upcoming: all.filter((b) => b.status === "signed" && Date.parse(b.start_at) > now).length,
  };
}
