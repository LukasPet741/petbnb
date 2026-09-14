/**
 * How long a booking lasts, and what that costs at the sitter's hourly rate.
 *
 * Both pure and deliberately outside the page: the live summary on /bookings/new asks
 * these questions on every keystroke, so they are called with HALF-FILLED input far
 * more often than with a complete booking. An empty field, a reversed range and a
 * sitter with no rate are the ordinary cases here, not the exotic ones — so both
 * functions answer "cannot say" rather than throwing or inventing a number.
 */

export interface BookingDuration {
  /** False whenever the range cannot be priced: empty, unparseable, reversed or zero-length. */
  valid: boolean;
  /** Hours between the two instants, fractional. 0 whenever `valid` is false. */
  hours: number;
}

const MS_PER_HOUR = 3_600_000;

/**
 * The gap between two `datetime-local` values, in hours.
 *
 * Measures real elapsed time, so a range crossing a daylight-saving boundary is
 * counted in hours actually worked rather than hours on the calendar: midnight to
 * midnight across the spring jump is 23, not 24. Date arithmetic in the local zone
 * gets this right for free; subtracting calendar fields would not.
 */
export function bookingDuration(startAt: string, endAt: string): BookingDuration {
  const none: BookingDuration = { valid: false, hours: 0 };
  if (!startAt || !endAt) return none;

  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return none;

  const hours = (end - start) / MS_PER_HOUR;
  // Zero-length is rejected along with reversed: a booking that ends when it starts
  // is not a booking, and pricing it at €0 would look like a working quote.
  if (hours <= 0) return none;

  return { valid: true, hours };
}

/**
 * What that duration costs, or null when it cannot be said.
 *
 * Null rather than 0 for the same reason SitterRating.average is null rather than 0:
 * the summary must render a dash for "unknown", and a zero here would read as a
 * genuine quote of nothing. `rate_per_hour` is nullable on profiles, so a sitter with
 * no rate is a real row, not a defensive hypothetical.
 */
export function estimatedTotal(hours: number, ratePerHour: number | null): number | null {
  if (hours <= 0 || ratePerHour === null || !Number.isFinite(ratePerHour)) return null;
  return hours * ratePerHour;
}

export type BookingRangeProblem = "startInPast" | "endBeforeStart";

/**
 * What is wrong with the dates as typed, or null when there is nothing to say yet.
 *
 * The only thing standing between a user and a booking for yesterday, or one that
 * ends before it starts: `bookings` has no check constraint on either column, so
 * whatever this page sends is stored.
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
