import type { AppNotification } from "@/lib/types";

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

const dayKey = (ms: number) => new Date(ms).toDateString();

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
