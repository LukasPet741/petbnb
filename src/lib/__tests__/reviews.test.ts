import { describe, it, expect } from "vitest";
import {
  averageRating,
  formatAverage,
  reviewCountForm,
  normaliseReviewBody,
  isValidRating,
  REVIEW_BODY_MAX_LENGTH,
} from "@/lib/reviews";

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

describe("normaliseReviewBody", () => {
  /**
   * The column is `check (body is null or char_length(btrim(body)) between 1 and 2000)`.
   * An empty string is therefore a constraint violation while NULL is fine, so a
   * review left blank has to reach the database as NULL and not as "". This is the
   * single rule that turns a textarea into something the schema accepts.
   */
  it("turns an untouched textarea into null rather than an empty string", () => {
    expect(normaliseReviewBody("")).toBeNull();
  });

  it.each([
    ["spaces", "   "],
    ["a newline", "\n"],
    ["a tab", "\t"],
    ["mixed whitespace", " \n\t "],
  ])("treats %s as no review body at all", (_label, input) => {
    expect(normaliseReviewBody(input)).toBeNull();
  });

  it("trims the edges of a real review, which the constraint checks btrim of anyway", () => {
    expect(normaliseReviewBody("  Lovely with our dog.  ")).toBe("Lovely with our dog.");
  });

  it("leaves the inside of a review alone, including its line breaks", () => {
    // ReviewList renders with whitespace-pre-line, so paragraphing is meaningful
    // and collapsing it here would silently reformat what somebody wrote.
    const written = "Great with Rex.\n\nWould book again.";
    expect(normaliseReviewBody(written)).toBe(written);
  });

  it("keeps a body that is exactly at the limit", () => {
    const atLimit = "x".repeat(REVIEW_BODY_MAX_LENGTH);
    expect(normaliseReviewBody(atLimit)).toBe(atLimit);
  });

  it("clips a body past the limit instead of letting the database reject it", () => {
    // The alternative is a 400 from PostgREST after the user has typed 2,001
    // characters, which tells them nothing they can act on.
    const tooLong = "x".repeat(REVIEW_BODY_MAX_LENGTH + 50);
    expect(normaliseReviewBody(tooLong)).toHaveLength(REVIEW_BODY_MAX_LENGTH);
  });
});

describe("isValidRating", () => {
  it.each([1, 2, 3, 4, 5])("accepts %i, which the CHECK constraint allows", (n) => {
    expect(isValidRating(n)).toBe(true);
  });

  it("rejects zero, which is how an unset form reports itself", () => {
    // StarInput uses 0 for "nothing chosen", so this is the guard that stops an
    // unanswered form being posted as a rating.
    expect(isValidRating(0)).toBe(false);
  });

  it.each([-1, 6, 99])("rejects %i, which is outside the scale", (n) => {
    expect(isValidRating(n)).toBe(false);
  });

  it("rejects a half star, because the column is a smallint", () => {
    // Stars renders halves for a computed average; a single review cannot be one.
    expect(isValidRating(4.5)).toBe(false);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a string", "5"],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s rather than passing it to the database", (_label, value) => {
    expect(isValidRating(value)).toBe(false);
  });
});
