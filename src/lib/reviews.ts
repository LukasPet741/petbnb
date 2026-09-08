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
