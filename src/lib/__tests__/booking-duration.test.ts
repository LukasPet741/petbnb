import { describe, it, expect } from "vitest";
import {
  bookingDuration,
  bookingRangeProblem,
  estimatedTotal,
  toDateTimeLocalValue,
} from "@/lib/booking-duration";

/**
 * How long a booking lasts, and what that costs at the sitter's hourly rate.
 *
 * Written for the live summary on /bookings/new, which fills in as the form is typed
 * — so every one of these functions is asked about HALF-FILLED input far more often
 * than about a complete booking. An empty field, a reversed range and a sitter with
 * no rate are the normal cases here, not the edge cases.
 *
 * Pure, and outside the page, so the arithmetic can be tested without a browser. The
 * harness pins TZ=Europe/Vilnius (vitest.config.mts), which is what makes the DST
 * assertion below portable rather than a machine-specific accident.
 */

describe("bookingDuration", () => {
  it("measures a simple range in hours", () => {
    expect(bookingDuration("2026-09-14T09:00", "2026-09-14T12:00")).toEqual({
      valid: true,
      hours: 3,
    });
  });

  it("keeps fractional hours rather than rounding them away", () => {
    // A 90-minute walk is a real booking, and rounding it to 1 or 2 would misprice it.
    expect(bookingDuration("2026-09-14T09:00", "2026-09-14T10:30")).toEqual({
      valid: true,
      hours: 1.5,
    });
  });

  it("spans days", () => {
    expect(bookingDuration("2026-09-14T09:00", "2026-09-16T09:00")).toEqual({
      valid: true,
      hours: 48,
    });
  });

  it("is not valid until both ends are filled in", () => {
    // The summary renders from the moment the page loads, with both fields empty.
    expect(bookingDuration("", "")).toEqual({ valid: false, hours: 0 });
    expect(bookingDuration("2026-09-14T09:00", "")).toEqual({ valid: false, hours: 0 });
    expect(bookingDuration("", "2026-09-14T12:00")).toEqual({ valid: false, hours: 0 });
  });

  it("is not valid when the end is before the start", () => {
    // Reachable by typing: nothing stops someone filling the end first, or picking
    // the wrong day. The summary must not show a negative duration or a negative price.
    expect(bookingDuration("2026-09-14T12:00", "2026-09-14T09:00")).toEqual({
      valid: false,
      hours: 0,
    });
  });

  it("is not valid for a zero-length booking", () => {
    expect(bookingDuration("2026-09-14T09:00", "2026-09-14T09:00")).toEqual({
      valid: false,
      hours: 0,
    });
  });

  it("is not valid for an unparseable date", () => {
    expect(bookingDuration("not a date", "2026-09-14T12:00")).toEqual({
      valid: false,
      hours: 0,
    });
  });

  it("counts wall-clock hours across the spring DST jump", () => {
    // Europe/Vilnius loses an hour at 03:00 on the last Sunday of March. Midnight to
    // midnight is 23 real hours, and the sitter is paid for hours worked, not for
    // hours on the calendar. Pinned because getting this wrong overcharges by an hour
    // exactly once a year, which is precisely the kind of bug nobody reproduces.
    expect(bookingDuration("2027-03-28T00:00", "2027-03-29T00:00")).toEqual({
      valid: true,
      hours: 23,
    });
  });
});

describe("estimatedTotal", () => {
  it("multiplies hours by the rate", () => {
    expect(estimatedTotal(3, 20)).toBe(60);
  });

  it("handles fractional hours", () => {
    expect(estimatedTotal(1.5, 20)).toBe(30);
  });

  it("returns null when the sitter has no rate", () => {
    // rate_per_hour is nullable on profiles, so a sitter can genuinely have none.
    // Null means "cannot say", which the summary shows as a dash — never as €0.
    expect(estimatedTotal(3, null)).toBeNull();
  });

  it("returns null for a duration that is not valid", () => {
    expect(estimatedTotal(0, 20)).toBeNull();
  });
});

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
