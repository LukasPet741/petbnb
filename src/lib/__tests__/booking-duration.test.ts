import { describe, it, expect } from "vitest";
import { bookingRangeProblem, toDateTimeLocalValue } from "@/lib/booking-duration";

/**
 * What is wrong with a booking's dates as typed. (Duration and price moved to
 * src/lib/pricing.ts with per-period prices, 2026-09-15.)
 *
 * Written for the live summary on /bookings/new, which fills in as the form is typed
 * — so every one of these functions is asked about HALF-FILLED input far more often
 * than about a complete booking. An empty field, a reversed range and a sitter with
 * no rate are the normal cases here, not the edge cases.
 *
 * Pure, and outside the page, so it can be tested without a browser. The harness pins
 * TZ=Europe/Vilnius (vitest.config.mts).
 */

describe("bookingRangeProblem", () => {
  // 14:05:30 on the 13th, Vilnius time. Seconds on purpose: datetime-local has minute
  // precision, so "now" always carries seconds the field cannot express.
  const now = new Date("2026-09-13T14:05:30");

  it("has nothing to say while the start is empty", () => {
    // The page's opening state. An error before anyone has typed is noise.
    expect(bookingRangeProblem("", "", now)).toBeNull();
    expect(bookingRangeProblem("", "2026-09-13T12:00", now)).toBeNull();
  });

  it("accepts a start later today with the end still empty", () => {
    expect(bookingRangeProblem("2026-09-13T16:00", "", now)).toBeNull();
  });

  it("accepts a valid future range", () => {
    expect(bookingRangeProblem("2026-09-14T09:00", "2026-09-14T12:00", now)).toBeNull();
  });

  it("refuses a start in the past", () => {
    // Nothing on the page or in the database stopped this: bookings has no check
    // constraint on either date, so a request for yesterday was sent as-is.
    expect(bookingRangeProblem("2026-09-12T09:00", "", now)).toBe("startInPast");
  });

  it("accepts a start in the current minute", () => {
    // 14:05 is the earliest value the field can show at 14:05:30. Calling it the past
    // would make "right now" impossible to book.
    expect(bookingRangeProblem("2026-09-13T14:05", "2026-09-13T15:00", now)).toBeNull();
  });

  it("refuses a start in the previous minute", () => {
    expect(bookingRangeProblem("2026-09-13T14:04", "2026-09-13T15:00", now)).toBe("startInPast");
  });

  it("refuses an end before the start", () => {
    // The live summary already declined to price this; the form still let it be sent.
    expect(bookingRangeProblem("2026-09-14T12:00", "2026-09-14T09:00", now)).toBe("endBeforeStart");
  });

  it("refuses an end equal to the start", () => {
    expect(bookingRangeProblem("2026-09-14T09:00", "2026-09-14T09:00", now)).toBe("endBeforeStart");
  });

  it("reports the start first when both are wrong", () => {
    // The start is the field above; fixing it usually moves what the end is compared to.
    expect(bookingRangeProblem("2026-09-12T12:00", "2026-09-12T09:00", now)).toBe("startInPast");
  });

  it("says nothing about a value it cannot parse", () => {
    // datetime-local cannot produce one. Guessing a problem would show a wrong message.
    expect(bookingRangeProblem("not a date", "2026-09-14T12:00", now)).toBeNull();
  });
});

describe("toDateTimeLocalValue", () => {
  it("formats a local instant the way datetime-local expects, to the minute", () => {
    // Used for the inputs' min attribute, which is compared as local wall-clock time.
    expect(toDateTimeLocalValue(new Date("2026-09-13T14:05:30"))).toBe("2026-09-13T14:05");
  });

  it("zero-pads single-digit fields", () => {
    expect(toDateTimeLocalValue(new Date("2027-01-02T03:04:00"))).toBe("2027-01-02T03:04");
  });
});
