/**
 * Sitter availability, mirrored from the database (migration *_sitter_availability): change both.
 * The database is the boundary; this says the same thing earlier, in the visitor's language.
 *
 * Days are calendar days in Europe/Vilnius, because a day off is a day to a person, not a UTC
 * window. A stay [start, end) touches every Vilnius day from the day of `start` to the day of
 * the last instant before `end`, the same as the SQL's
 * `((p_end - interval '1 microsecond') at time zone 'Europe/Vilnius')::date`.
 *
 * Day strings are "YYYY-MM-DD" throughout. Date arithmetic on them runs in UTC, where every day
 * is 24 hours long, so a clock change can never skip or repeat a day.
 */
export type AvailabilityProblem = "sitter_unavailable" | "already_booked";
export type BusyKind = "off" | "booked";

// en-CA formats as YYYY-MM-DD.
const vilniusDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Vilnius",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Vilnius calendar day an instant falls on. */
export function vilniusDay(instant: Date | string): string {
  return vilniusDayFormat.format(new Date(instant));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Every day from `from` to `to`, both included; empty when `to` is before `from`. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The Vilnius days a stay [start, end) touches; empty for an unparseable or empty stay. */
export function daysInStay(startIso: string, endIso: string): string[] {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  return daysBetween(vilniusDay(new Date(start)), vilniusDay(new Date(end - 1)));
}

/**
 * sitter_busy_days rows as a lookup. A day can be both a day off and covered by an accepted
 * booking; "booked" wins, because that is the stronger reason the day is gone.
 */
export function busyMap(rows: { day: string; kind: BusyKind }[]): Map<string, BusyKind> {
  const map = new Map<string, BusyKind>();
  for (const { day, kind } of rows) {
    if (map.get(day) !== "booked") map.set(day, kind);
  }
  return map;
}

/**
 * What the booking form should say about a typed stay, or null.
 *
 * A day off blocks: the database refuses any stay touching one, so the answer is certain. A
 * booked day only warns: the database compares hours, and a stay ending at 10:00 does not clash
 * with one starting at 14:00 the same day, which a day-level view cannot tell apart.
 */
export function formClash(
  startIso: string,
  endIso: string,
  busy: Map<string, BusyKind>,
): { block: boolean; kind: BusyKind } | null {
  if (!startIso || !endIso) return null;
  const days = daysInStay(startIso, endIso);
  if (days.some((d) => busy.get(d) === "off")) return { block: true, kind: "off" };
  if (days.some((d) => busy.get(d) === "booked")) return { block: false, kind: "booked" };
  return null;
}

/**
 * A month laid out Monday-first for a calendar grid: null for the blank cells before the 1st
 * and after the last day, padded to whole weeks. `month0` is 0-based and may run past 11.
 */
export function monthGrid(year: number, month0: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const count = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= count; d++) {
    cells.push(new Date(Date.UTC(year, month0, d)).toISOString().slice(0, 10));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** The availability reason in a database error's hint, or null for any other error. */
export function problemFromHint(hint: string | undefined | null): AvailabilityProblem | null {
  return hint === "sitter_unavailable" || hint === "already_booked" ? hint : null;
}

/**
 * The message for a clash refused on accept, for whoever pressed accept. The clash is always the
 * sitter's: they can free their days, while an owner agreeing to a counter-offer can only pick
 * other dates (review I4, 2026-09-26). `sitterKeys` is the page's own namespace for the sitter.
 */
export function acceptClashKey(
  problem: AvailabilityProblem,
  viewer: "owner" | "sitter",
  sitterKeys: "appPages.bookings" | "messages.offer",
): string {
  const namespace = viewer === "sitter" ? sitterKeys : "appPages.bookingsNew";
  return `${namespace}.${problem === "sitter_unavailable" ? "sitterUnavailable" : "alreadyBooked"}`;
}
