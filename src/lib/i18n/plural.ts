import type { Locale } from "./index";

export type PluralForm = "one" | "few" | "other";

/**
 * Picks the count-agreement form for a locale.
 *
 * Lithuanian needs THREE forms where English needs two:
 *   one   - 1, 21, 31, 101        "1 globėjas"
 *   few   - 2..9, 22..29          "5 globėjai"
 *   other - 0, 10..20, 30         "10 globėjų"
 *
 * The rest of this app pluralises with a hand-rolled `n !== 1` ternary and
 * stores only two Lithuanian forms, so every count from 2 to 9 renders the
 * genitive where the nominative plural is correct. That bug is documented and
 * pinned in src/lib/i18n/__tests__/parity.test.ts. It is not fixed here, but
 * new keys do not inherit it: the city counts on the landing page are almost
 * all in the 2..9 range, which is exactly the range the old ternary gets wrong.
 *
 * Keys used with this helper store { one, few, other }. English resolves "few"
 * never, so its "few" value simply matches its "other" value.
 */
export function pluralForm(locale: Locale, count: number): PluralForm {
  const category = new Intl.PluralRules(locale).select(count);
  return category === "one" || category === "few" ? category : "other";
}
