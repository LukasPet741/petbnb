import { describe, it, expect, vi, afterEach } from "vitest";
import {
  todayInputValue,
  haversineKm,
  routeStats,
  currentWeekDates,
  weekdayShort,
} from "@/components/CollarsPanel";

// The pure date/geo maths behind the collar panel. All of it is timezone
// sensitive and the suite pins TZ to Europe/Vilnius.

const pt = (lat: number, lng: number, recorded_at: string) => ({ lat, lng, recorded_at });

afterEach(() => {
  vi.useRealTimers();
});

describe("haversineKm", () => {
  it("returns exactly zero for two identical points", () => {
    // asin(sqrt(0)) is exactly 0, so no epsilon tolerance is needed here.
    expect(haversineKm({ lat: 54.68, lng: 25.28 }, { lat: 54.68, lng: 25.28 })).toBe(0);
  });

  it("measures a short Vilnius step", () => {
    const km = haversineKm({ lat: 54.68, lng: 25.28 }, { lat: 54.69, lng: 25.29 });
    expect(km).toBeCloseTo(1.2844, 3);
  });

  it("measures a metre-scale delta without collapsing to zero", () => {
    const km = haversineKm({ lat: 54.68, lng: 25.28 }, { lat: 54.680009, lng: 25.28 });
    expect(km).toBeGreaterThan(0);
    expect(km).toBeCloseTo(0.001, 4);
  });

  it("takes the short way across the antimeridian rather than the long way round", () => {
    // The single most valuable assertion here. A naive delta-based formula
    // would report ~40000 km for this pair; haversine correctly gives ~22 km.
    const km = haversineKm({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 });
    expect(km).toBeCloseTo(22.24, 1);
    expect(km).toBeLessThan(100);
  });

  it("measures antipodal points as half the earth's circumference", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20015.1, 0);
  });

  it("measures pole to pole", () => {
    expect(haversineKm({ lat: 90, lng: 0 }, { lat: -90, lng: 0 })).toBeCloseTo(20015.1, 0);
  });

  it("ignores longitude entirely at the poles", () => {
    expect(haversineKm({ lat: 90, lng: 0 }, { lat: 90, lng: 137 })).toBeCloseTo(0, 6);
  });

  // BUG (propagation): there is no finiteness guard. A NaN coordinate yields a
  // NaN distance, which flows into the weekly total. The panel then tests
  // `totalDistanceKm <= 0` to decide whether to render, and that comparison is
  // FALSE for NaN, so the strip renders and shows "NaN km this week".
  it.each([
    ["latitude", { lat: NaN, lng: 25.28 }],
    ["longitude", { lat: 54.68, lng: NaN }],
  ])("returns NaN when %s is NaN (current buggy behaviour)", (_label, bad) => {
    expect(haversineKm(bad, { lat: 54.69, lng: 25.29 })).toBeNaN();
  });

  it("lets a NaN distance slip past the panel's positivity guard", () => {
    // Demonstrates the exact condition CollarsPanel uses before rendering.
    const total = haversineKm({ lat: NaN, lng: 0 }, { lat: 1, lng: 1 });
    expect(total <= 0).toBe(false);
    expect(Number.isNaN(total)).toBe(true);
  });

  it("computes a value for out-of-range coordinates instead of rejecting them", () => {
    // No validation: a latitude of 91 is silently treated as a real position.
    expect(Number.isFinite(haversineKm({ lat: 91, lng: 0 }, { lat: 0, lng: 0 }))).toBe(true);
  });
});

describe("routeStats", () => {
  it("returns null for an empty list", () => {
    expect(routeStats([])).toBeNull();
  });

  it("returns null for a single point, since one fix is not a route", () => {
    // Drives the "not enough for a route yet" copy in the panel.
    expect(routeStats([pt(54.68, 25.28, "2026-09-10T09:00:00Z")])).toBeNull();
  });

  it("measures distance and duration for two points", () => {
    const stats = routeStats([
      pt(54.68, 25.28, "2026-09-10T09:00:00Z"),
      pt(54.69, 25.29, "2026-09-10T09:30:00Z"),
    ]);
    expect(stats?.distanceKm).toBeCloseTo(1.2844, 3);
    expect(stats?.durationMin).toBe(30);
  });

  it("sums every leg rather than measuring start to end", () => {
    // An out-and-back route returns to its origin; a start-to-end measurement
    // would report zero distance for a real walk.
    const there = pt(54.68, 25.28, "2026-09-10T09:00:00Z");
    const away = pt(54.69, 25.29, "2026-09-10T09:15:00Z");
    const back = pt(54.68, 25.28, "2026-09-10T09:30:00Z");
    const stats = routeStats([there, away, back]);
    expect(stats?.distanceKm).toBeCloseTo(2.5688, 3);
  });

  it("reports zero distance and duration for repeated identical fixes", () => {
    const stats = routeStats([
      pt(54.68, 25.28, "2026-09-10T09:00:00Z"),
      pt(54.68, 25.28, "2026-09-10T09:00:00Z"),
    ]);
    expect(stats).toEqual({ distanceKm: 0, durationMin: 0 });
  });

  it("measures true elapsed time across a DST change, not wall-clock difference", () => {
    // 2026-03-29 in Vilnius: local clocks jump 03:00 -> 04:00. The wall clock
    // suggests two hours, but only one hour actually elapsed. Because the
    // maths is on epoch milliseconds, the honest answer comes out.
    const stats = routeStats([
      pt(54.68, 25.28, "2026-03-29T00:30:00Z"),
      pt(54.68, 25.28, "2026-03-29T01:30:00Z"),
    ]);
    expect(stats?.durationMin).toBe(60);
  });

  // BUG: the duration is taken from the first and last array entries with no
  // ordering check, so an unsorted list yields a negative duration, rendered
  // to the user as something like "-30 min". The panel's own query orders
  // ascending, so this is latent rather than live - but nothing enforces it.
  it("returns a negative duration for unsorted points (current buggy behaviour)", () => {
    const stats = routeStats([
      pt(54.68, 25.28, "2026-09-10T09:30:00Z"),
      pt(54.69, 25.29, "2026-09-10T09:00:00Z"),
    ]);
    expect(stats?.durationMin).toBe(-30);
  });

  // BUG: no Invalid-Date guard, matching the pattern in lib/utils.
  it("returns a NaN duration for an unparseable timestamp (current buggy behaviour)", () => {
    const stats = routeStats([
      pt(54.68, 25.28, "garbage"),
      pt(54.69, 25.29, "2026-09-10T09:30:00Z"),
    ]);
    expect(stats?.durationMin).toBeNaN();
  });

  it("accumulates a long route without drifting", () => {
    const points = Array.from({ length: 500 }, (_, i) =>
      pt(54.68 + i * 0.0001, 25.28, `2026-09-10T09:00:00Z`),
    );
    const stats = routeStats(points);
    // 499 legs of ~0.0001 degrees of latitude, roughly 11.1 m each.
    expect(stats?.distanceKm).toBeCloseTo(5.55, 1);
  });
});

describe("currentWeekDates", () => {
  const weekAt = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    return currentWeekDates();
  };

  it("starts the week on Monday when today is Monday", () => {
    // 2026-09-07 is a Monday.
    const week = weekAt("2026-09-07T12:00:00+03:00");
    expect(week[0]).toBe("2026-09-07");
    expect(week[6]).toBe("2026-09-13");
  });

  it("puts a midweek day in its correct slot", () => {
    // 2026-09-10 is a Thursday, so index 3.
    const week = weekAt("2026-09-10T12:00:00+03:00");
    expect(week[3]).toBe("2026-09-10");
    expect(week[0]).toBe("2026-09-07");
  });

  // The single most important branch: getDay() is 0 on Sunday, so a naive
  // `1 - day` would jump forward to the NEXT Monday. The -6 special case makes
  // Sunday belong to the week that is ending, which is what a user expects
  // from a "this week" summary.
  it("treats Sunday as the last day of the week that is ending, not the first of the next", () => {
    // 2026-09-13 is a Sunday.
    const week = weekAt("2026-09-13T12:00:00+03:00");
    expect(week[0]).toBe("2026-09-07");
    expect(week[6]).toBe("2026-09-13");
  });

  it("rolls back into the previous month when the week straddles it", () => {
    // 2026-03-01 is a Sunday, so its week starts in February.
    const week = weekAt("2026-03-01T12:00:00+02:00");
    expect(week[0]).toBe("2026-02-23");
    expect(week[6]).toBe("2026-03-01");
  });

  it("rolls back across a year boundary", () => {
    // 2026-01-01 is a Thursday; its Monday is in December 2025.
    const week = weekAt("2026-01-01T12:00:00+02:00");
    expect(week[0]).toBe("2025-12-29");
    expect(week[6]).toBe("2026-01-04");
  });

  it("includes the leap day in the right week", () => {
    // 2028-02-29 is a Tuesday.
    const week = weekAt("2028-02-29T12:00:00+02:00");
    expect(week).toContain("2028-02-29");
    expect(week[0]).toBe("2028-02-28");
  });

  it("stays consecutive across the spring DST transition", () => {
    // The week containing 2026-03-29, when local clocks lose an hour.
    const week = weekAt("2026-03-29T12:00:00+03:00");
    expect(week).toContain("2026-03-29");
    expect(week[0]).toBe("2026-03-23");
  });

  it("does not slip a day when called just before local midnight", () => {
    const week = weekAt("2026-09-10T23:59:00+03:00");
    expect(week[3]).toBe("2026-09-10");
  });

  it.each([
    "2026-09-07T08:00:00+03:00",
    "2026-09-08T23:30:00+03:00",
    "2026-09-13T00:01:00+03:00",
    "2026-01-01T12:00:00+02:00",
    "2026-03-29T12:00:00+03:00",
    "2026-10-25T12:00:00+03:00",
    "2028-02-29T12:00:00+02:00",
  ])("always returns seven distinct consecutive dates, seeded at %s", (iso) => {
    const week = weekAt(iso);
    expect(week).toHaveLength(7);
    expect(new Set(week).size).toBe(7);
    expect([...week].sort()).toEqual(week);
    for (const d of week) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Consecutive: each entry is exactly one day after the previous.
    for (let i = 1; i < week.length; i++) {
      const prev = new Date(`${week[i - 1]}T00:00:00Z`).getTime();
      const cur = new Date(`${week[i]}T00:00:00Z`).getTime();
      expect(cur - prev).toBe(86_400_000);
    }
  });
});

describe("todayInputValue", () => {
  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    return todayInputValue();
  };

  it("returns the local date, not the UTC date", () => {
    // 23:59 Vilnius on the 10th is already 20:59 UTC the same day, but the
    // offset correction is what keeps late-evening use from slipping a day.
    expect(at("2026-09-10T23:59:00+03:00")).toBe("2026-09-10");
  });

  it("returns the local date just after local midnight", () => {
    expect(at("2026-09-11T00:01:00+03:00")).toBe("2026-09-11");
  });

  it("returns a plain YYYY-MM-DD string suitable for a date input", () => {
    expect(at("2026-09-10T12:00:00+03:00")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles a DST transition day", () => {
    expect(at("2026-10-25T12:00:00+02:00")).toBe("2026-10-25");
  });
});

describe("weekdayShort", () => {
  it.each([
    ["2026-09-07", "Mon"],
    ["2026-09-10", "Thu"],
    ["2026-09-13", "Sun"],
  ])("formats %s as %s in English", (date, expected) => {
    expect(weekdayShort(date, "en")).toBe(expected);
  });

  it("leaves already-capitalised English abbreviations unchanged", () => {
    expect(weekdayShort("2026-09-07", "en")).toBe("Mon");
  });

  it.each([
    ["2026-09-07", "Pr"],
    ["2026-09-08", "An"],
    ["2026-09-09", "Tr"],
    ["2026-09-10", "Kt"],
    ["2026-09-11", "Pn"],
    ["2026-09-13", "Sk"],
  ])("capitalises the lowercase Lithuanian abbreviation for %s as %s", (date, expected) => {
    // Lithuanian short weekdays come out of Intl lowercase, so the manual
    // capitalisation is load-bearing rather than cosmetic.
    expect(weekdayShort(date, "lt")).toBe(expected);
  });

  it("preserves the diacritic when capitalising Saturday", () => {
    // "št" -> "Št": toUpperCase must not strip the caron.
    expect(weekdayShort("2026-09-12", "lt")).toBe("Št");
  });

  it("falls back to English for any locale that is not exactly lt", () => {
    expect(weekdayShort("2026-09-07", "de")).toBe("Mon");
  });

  // BUG: no Invalid-Date guard, so a cleared date input crashes the panel.
  // Reachable: the route drawer's date field can be emptied by the user.
  it.each([
    ["an empty string", ""],
    ["a malformed date", "2026-13-01"],
  ])("throws RangeError for %s (current buggy behaviour)", (_label, value) => {
    expect(() => weekdayShort(value, "en")).toThrow(RangeError);
  });

  it("formats every date currentWeekDates produces without throwing", () => {
    // Ties the two helpers together: whatever the week generator emits must be
    // safe to feed to the formatter.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00+03:00"));
    for (const date of currentWeekDates()) {
      expect(() => weekdayShort(date, "lt")).not.toThrow();
      expect(weekdayShort(date, "lt")).toMatch(/^\p{Lu}/u);
    }
  });
});

describe("activity bucketing thresholds", () => {
  // The panel buckets each fix by speed inline. Reproduced here exactly so the
  // boundaries and the NaN hole are pinned; the constants are 1 and 7 km/h.
  const RESTING_MAX = 1;
  const WALKING_MAX = 7;
  const bucket = (speed: number) =>
    speed < RESTING_MAX ? "resting" : speed <= WALKING_MAX ? "walking" : "running";

  it.each([
    [0, "resting"],
    [0.99, "resting"],
    [1, "walking"],
    [7, "walking"],
    [7.0001, "running"],
    [20, "running"],
  ])("buckets %p km/h as %s", (speed, expected) => {
    expect(bucket(speed)).toBe(expected);
  });

  it("buckets a negative speed as resting", () => {
    expect(bucket(-5)).toBe("resting");
  });

  // BUG: every comparison against NaN is false, so a NaN speed falls through
  // both branches and is counted as RUNNING - the most active bucket, from the
  // least trustworthy data.
  it("buckets a NaN speed as running (current buggy behaviour)", () => {
    expect(bucket(NaN)).toBe("running");
  });

  // BUG: the three percentages are rounded independently, so they need not sum
  // to 100. With one point in each bucket the bar renders 33/33/33 and leaves
  // a visible 1% gap; other splits overflow to 101%.
  it("produces percentages that do not sum to 100 for an even three-way split", () => {
    const total = 3;
    const pct = (n: number) => Math.round((n / total) * 100);
    const sum = pct(1) + pct(1) + pct(1);
    expect(sum).toBe(99);
  });

  it("produces percentages that overflow past 100 for a one-sixth split", () => {
    const total = 6;
    const pct = (n: number) => Math.round((n / total) * 100);
    expect(pct(1) + pct(1) + pct(4)).toBe(101);
  });
});
