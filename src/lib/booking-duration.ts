/**
 * What is wrong with a booking's dates as typed, for /bookings/new. Pure, because the form asks
 * on every keystroke with half-filled input. How long a stay is and what it costs moved to
 * src/lib/pricing.ts with per-period prices (2026-09-15).
 */

export type BookingRangeProblem = "startInPast" | "endBeforeStart";

/**
 * What is wrong with the dates as typed, or null when there is nothing to say yet.
 *
 * The database refuses both as well -- bookings_range_check, and enforce_booking_rules
 * for a start in the past, with 15 minutes of slack for clocks that disagree (migration
 * 20260914193216). So this is not what stops the insert; it is what tells the user, in
 * their language and inside the right field, before they send.
 *
 * Silent until there is something to judge — an empty start is the opening state, not
 * an error — and it reports one problem at a time, the start's before the end's.
 *
 * "The past" means before the current MINUTE. datetime-local cannot express seconds,
 * so at 14:05:30 the earliest value the field can hold is 14:05; refusing that would
 * make "now" unbookable.
 */
export function bookingRangeProblem(
  startAt: string,
  endAt: string,
  now: Date,
): BookingRangeProblem | null {
  if (!startAt) return null;
  const start = new Date(startAt).getTime();
  if (Number.isNaN(start)) return null;

  const currentMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  if (start < currentMinute) return "startInPast";

  if (!endAt) return null;
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return null;
  return end <= start ? "endBeforeStart" : null;
}

/**
 * A Date as a `datetime-local` value ("YYYY-MM-DDTHH:mm") in the LOCAL zone — the
 * format the inputs' `min` attribute compares against. `toISOString()` would be UTC
 * and three hours early in Vilnius summer time.
 */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
