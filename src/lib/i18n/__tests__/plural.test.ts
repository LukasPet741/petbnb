import { describe, it, expect } from "vitest";
import { pluralForm } from "@/lib/i18n/plural";

/**
 * The landing page shows city sitter counts, and real counts sit in the 2..9
 * range - exactly the range the app's older `n !== 1` ternary gets wrong in
 * Lithuanian, where it renders the genitive "5 globėjų" instead of the
 * nominative plural "5 globėjai". These pin the three-form selection so a
 * regression back to two forms fails here rather than in front of a user.
 */
describe("Lithuanian", () => {
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
    [19, "other"],
    [20, "other"],
  ])("picks the %s-count form", (count, expected) => {
    expect(pluralForm("lt", count)).toBe(expected);
  });
});

describe("English", () => {
  it("uses the singular for one", () => {
    expect(pluralForm("en", 1)).toBe("one");
  });

  it.each([0, 2, 5, 11, 21])("uses the plural for %i, since English has no few", (count) => {
    expect(pluralForm("en", count)).toBe("other");
  });
});
