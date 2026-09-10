import { describe, it, expect } from "vitest";
import lt from "@/lib/i18n/lt";
import en from "@/lib/i18n/en";
import { lookup } from "@/context/LanguageContext";
import { pluralForm } from "@/lib/i18n/plural";

/**
 * Every key that counts something must store three Lithuanian forms.
 *
 * Lithuanian agrees in three groups where English has two:
 *   one    1, 21, 31       Rastas 1 globėjas
 *   few    2-9, 22-29      Rasti 5 globėjai
 *   other  0, 10-20, 30    Rasta 12 globėjų
 *
 * The app used to store two forms and branch on `n !== 1`, which rendered the
 * genitive for every count from 2 to 9 — "Rasta 5 globėjų" instead of "Rasti 5
 * globėjai". One key failed at the opposite end instead: its two forms were the
 * singular and the *nominative* plural, so it read correctly for 2-9 and wrongly
 * for 10 and above.
 *
 * This test exists so neither shape can come back.
 */

/** Every key in the app whose value counts something. */
const COUNTING_KEYS = [
  "home.cities.sitterCount",
  "appPages.browse.resultsCount",
  "appPages.bookings.count",
  "appPages.pets.count",
  "appPages.collars.routeNotEnough",
  "appShell.dashboard.summary.pendingCount",
  "sitters.reviews.count",
] as const;

const FORMS = ["one", "few", "other"] as const;

describe("count agreement", () => {
  it.each(COUNTING_KEYS)("%s stores all three Lithuanian forms", (key) => {
    for (const form of FORMS) {
      const value = lookup(lt as unknown as Record<string, unknown>, `${key}.${form}`);
      expect(typeof value, `${key}.${form} is missing from lt`).toBe("string");
    }
  });

  it.each(COUNTING_KEYS)("%s stores all three forms in English too", (key) => {
    // English never resolves "few", but the key has to exist so one shared lookup
    // works for both languages rather than branching on locale at every call site.
    for (const form of FORMS) {
      const value = lookup(en as unknown as Record<string, unknown>, `${key}.${form}`);
      expect(typeof value, `${key}.${form} is missing from en`).toBe("string");
    }
  });

  it.each(COUNTING_KEYS)("%s says something different for 2-9 than for 10+", (key) => {
    // This is the bug itself. When a key held two forms, "few" and "other" were the
    // same string, and 5 rendered as though it were 12.
    const few = lookup(lt as unknown as Record<string, unknown>, `${key}.few`);
    const other = lookup(lt as unknown as Record<string, unknown>, `${key}.other`);
    expect(few).not.toBe(other);
  });

  it.each(COUNTING_KEYS)("%s keeps its {count} placeholder in every form", (key) => {
    for (const form of FORMS) {
      const value = lookup(lt as unknown as Record<string, unknown>, `${key}.${form}`) as string;
      expect(value, `${key}.${form}`).toMatch(/\{(count|points|pending|years)\}/);
    }
  });
});

describe("pluralForm picks the form these keys are written for", () => {
  it.each([
    [1, "one"],
    [21, "one"],
    [101, "one"],
    [2, "few"],
    [5, "few"],
    [9, "few"],
    [22, "few"],
    [0, "other"],
    [10, "other"],
    [11, "other"],
    [20, "other"],
    [100, "other"],
  ])("Lithuanian %i takes the %s form", (count, expected) => {
    expect(pluralForm("lt", count)).toBe(expected);
  });

  it.each([
    [1, "one"],
    [2, "other"],
    [5, "other"],
    [21, "other"],
  ])("English %i takes the %s form", (count, expected) => {
    expect(pluralForm("en", count)).toBe(expected);
  });
});
