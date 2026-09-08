import { describe, it, expect } from "vitest";
import { averageRating, formatAverage, reviewCountForm } from "@/lib/reviews";

describe("averageRating", () => {
  it("has no average when nobody has reviewed yet", () => {
    // The distinction matters: a sitter with no reviews must render "no reviews yet",
    // not "0.0 stars", which reads as a terrible sitter rather than a new one.
    expect(averageRating([])).toBeNull();
  });

  it("returns the single rating when there is only one", () => {
    expect(averageRating([4])).toBe(4);
  });

  it("averages several ratings", () => {
    expect(averageRating([5, 4, 3])).toBe(4);
  });

  it("rounds to one decimal place", () => {
    // 14/3 = 4.666..., which must not reach the UI at full precision.
    expect(averageRating([5, 5, 4])).toBe(4.7);
  });

  it("rounds half up rather than to even", () => {
    expect(averageRating([5, 4])).toBe(4.5);
    expect(averageRating([5, 4, 4, 4])).toBe(4.3);
  });

  it("ignores ratings outside the 1-5 range rather than letting them skew the mean", () => {
    // The database constrains this, but the client also receives rows from a view
    // and from seed data, and a single 0 or 50 would silently distort every card.
    expect(averageRating([5, 5, 0])).toBe(5);
    expect(averageRating([4, 99])).toBe(4);
  });

  it("has no average when every rating was invalid", () => {
    expect(averageRating([0, 7])).toBeNull();
  });
});

describe("formatAverage", () => {
  it("always shows one decimal, so 4 does not render as bare 4", () => {
    expect(formatAverage("en", 4)).toBe("4.0");
  });

  it("uses a decimal comma in Lithuanian", () => {
    // lt-LT writes 4,8 — rendering "4.8" to a Lithuanian reader is simply wrong,
    // and this is the kind of thing a hand-rolled toFixed(1) gets wrong everywhere.
    expect(formatAverage("lt", 4.8)).toBe("4,8");
  });

  it("uses a decimal point in English", () => {
    expect(formatAverage("en", 4.8)).toBe("4.8");
  });
});

describe("reviewCountForm", () => {
  /**
   * Lithuanian needs three count-agreement forms. The rest of this app branches on
   * `n !== 1` and stores only two, so counts 2-9 render the genitive where the
   * nominative plural is correct — a documented, unfixed bug. Review counts are
   * overwhelmingly in that 2-9 range, so these keys must not inherit it.
   */
  it("picks the one form for a single review", () => {
    expect(reviewCountForm("lt", 1)).toBe("one");
  });

  it("picks the few form for the 2-9 range Lithuanian gets wrong elsewhere", () => {
    for (const n of [2, 5, 9, 22]) {
      expect(reviewCountForm("lt", n), `count ${n}`).toBe("few");
    }
  });

  it("picks the other form for the teens and round tens", () => {
    for (const n of [0, 10, 11, 19, 20]) {
      expect(reviewCountForm("lt", n), `count ${n}`).toBe("other");
    }
  });

  it("picks the one form for 21 and 101, which English would call plural", () => {
    expect(reviewCountForm("lt", 21)).toBe("one");
    expect(reviewCountForm("lt", 101)).toBe("one");
  });

  it("never asks English for a few form", () => {
    // English has no distinct "few", so its dictionary entry mirrors "other".
    for (const n of [2, 5, 9]) {
      expect(reviewCountForm("en", n)).toBe("other");
    }
  });
});
