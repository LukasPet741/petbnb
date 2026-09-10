import type { Locale } from "@/lib/i18n";
import { pluralForm, type PluralForm } from "@/lib/i18n/plural";

/** The inclusive rating range the database constrains reviews.rating to. */
const MIN_RATING = 1;
const MAX_RATING = 5;

/**
 * The mean of a sitter's ratings, to one decimal, or null when there is nothing
 * to average.
 *
 * Null rather than 0 is the whole point: a sitter with no reviews has not been
 * rated badly, they have not been rated at all, and "0.0" on a card would say the
 * opposite. Callers are expected to branch on null and show a "new sitter" state.
 *
 * Out-of-range values are discarded rather than trusted. The column has a CHECK
 * constraint, but these numbers also arrive from a view and from seed data, and one
 * stray 0 or 50 would quietly skew a card that readers treat as fact.
 */
export function averageRating(ratings: number[]): number | null {
  const valid = ratings.filter(
    (r) => Number.isFinite(r) && r >= MIN_RATING && r <= MAX_RATING,
  );
  if (valid.length === 0) return null;

  const mean = valid.reduce((sum, r) => sum + r, 0) / valid.length;
  // Scale-then-round, so 4.65 goes to 4.7 rather than to even. The epsilon absorbs
  // binary float error: 4.65 is stored as 4.6499999..., which would round down.
  return Math.round((mean + Number.EPSILON) * 10) / 10;
}

/**
 * A rating formatted for display, always with one decimal.
 *
 * Locale-aware on purpose: Lithuanian writes 4,8 rather than 4.8, so a hand-rolled
 * toFixed(1) would print a decimal point to every Lithuanian reader on the site.
 */
export function formatAverage(locale: Locale, average: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
}

/**
 * The count-agreement form for "{count} reviews".
 *
 * Review counts sit overwhelmingly in the 2-9 range, which is exactly the range the
 * app's older `n !== 1` ternary gets wrong in Lithuanian. These keys are stored as
 * { one, few, other } so they never inherit that documented bug.
 */
export function reviewCountForm(locale: Locale, count: number): PluralForm {
  return pluralForm(locale, count);
}

/**
 * The longest body the reviews CHECK constraint accepts.
 *
 * `check (body is null or char_length(btrim(body)) between 1 and 2000)` — the upper
 * bound is duplicated here so the form can stop at the limit rather than discovering
 * it as a 400 from PostgREST after somebody has written 2,001 characters.
 */
export const REVIEW_BODY_MAX_LENGTH = 2000;

/**
 * What the review textarea should send to the database.
 *
 * The constraint rejects an empty string and accepts NULL, so "left blank" has to
 * become null rather than "". A star with no words is a complete review; requiring
 * text would cost most of them.
 *
 * The inside of the text is left exactly as written — ReviewList renders it with
 * whitespace-pre-line, so paragraph breaks are meaningful and collapsing them would
 * silently reformat what somebody wrote.
 */
export function normaliseReviewBody(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, REVIEW_BODY_MAX_LENGTH);
}

/**
 * Whether a rating is one the column will accept: a whole number from 1 to 5.
 *
 * Zero is excluded deliberately — it is how StarInput reports "nothing chosen", and
 * it is the value that must not reach a NOT NULL column. Halves are excluded because
 * rating is a smallint; Stars renders half stars for a computed average, but a single
 * review can never be one.
 */
export function isValidRating(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_RATING &&
    value <= MAX_RATING
  );
}
