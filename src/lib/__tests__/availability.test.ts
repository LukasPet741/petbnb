import { describe, it, expect } from "vitest";
import {
  acceptClashKey,
  vilniusDay,
  addDays,
  daysInStay,
  daysBetween,
  busyMap,
  formClash,
  monthGrid,
  problemFromHint,
} from "@/lib/availability";

describe("vilniusDay", () => {
  it("uses Vilnius, not UTC: 23:30 UTC on 30 Sep is already 1 Oct in Vilnius (UTC+3 in summer)", () => {
    expect(vilniusDay("2026-09-30T23:30:00Z")).toBe("2026-10-01");
  });

  it("handles winter time (UTC+2)", () => {
    expect(vilniusDay("2026-12-31T22:30:00Z")).toBe("2027-01-01");
    expect(vilniusDay("2026-12-31T21:30:00Z")).toBe("2026-12-31");
  });

  it("accepts a Date", () => {
    expect(vilniusDay(new Date("2026-10-01T12:00:00+03:00"))).toBe("2026-10-01");
  });
});

describe("addDays / daysBetween", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("is not thrown by the clock change: the last Sunday of October is one day", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });

  it("an inverted range is empty, a one-day range is that day", () => {
    expect(daysBetween("2026-10-02", "2026-10-01")).toEqual([]);
    expect(daysBetween("2026-10-01", "2026-10-01")).toEqual(["2026-10-01"]);
  });
});

describe("daysInStay (half-open, mirrors the SQL)", () => {
  it("a stay ending at midnight does not touch the next day", () => {
    expect(daysInStay("2026-10-01T09:00:00+03:00", "2026-10-03T00:00:00+03:00")).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("a one-hour walk covers one day", () => {
    expect(daysInStay("2026-10-01T09:00:00+03:00", "2026-10-01T10:00:00+03:00")).toEqual(["2026-10-01"]);
  });

  it("crosses a month end", () => {
    expect(daysInStay("2026-09-30T09:00:00+03:00", "2026-10-01T09:00:00+03:00")).toEqual(["2026-09-30", "2026-10-01"]);
  });

  it("an empty, reversed or unparseable stay covers nothing", () => {
    expect(daysInStay("2026-10-01T09:00:00+03:00", "2026-10-01T09:00:00+03:00")).toEqual([]);
    expect(daysInStay("2026-10-02T09:00:00+03:00", "2026-10-01T09:00:00+03:00")).toEqual([]);
    expect(daysInStay("nonsense", "2026-10-01T09:00:00+03:00")).toEqual([]);
  });
});

describe("busyMap", () => {
  it("booked wins when a day is both off and booked, whichever row comes first", () => {
    const rows = [
      { day: "2026-10-01", kind: "off" as const },
      { day: "2026-10-01", kind: "booked" as const },
      { day: "2026-10-02", kind: "booked" as const },
      { day: "2026-10-02", kind: "off" as const },
      { day: "2026-10-03", kind: "off" as const },
    ];
    const m = busyMap(rows);
    expect(m.get("2026-10-01")).toBe("booked");
    expect(m.get("2026-10-02")).toBe("booked");
    expect(m.get("2026-10-03")).toBe("off");
    expect(m.size).toBe(3);
  });
});

describe("formClash", () => {
  const busy = busyMap([
    { day: "2026-10-02", kind: "off" },
    { day: "2026-10-05", kind: "booked" },
  ]);

  it("a day off inside the stay blocks, since the database refuses exactly this", () => {
    expect(formClash("2026-10-01T09:00:00+03:00", "2026-10-03T09:00:00+03:00", busy)).toEqual({ block: true, kind: "off" });
  });

  it("a booked day only warns, since the two stays' hours may not overlap", () => {
    expect(formClash("2026-10-05T14:00:00+03:00", "2026-10-06T09:00:00+03:00", busy)).toEqual({ block: false, kind: "booked" });
  });

  it("a day off outweighs a booked day in the same stay", () => {
    expect(formClash("2026-10-02T09:00:00+03:00", "2026-10-06T09:00:00+03:00", busy)).toEqual({ block: true, kind: "off" });
  });

  it("a stay ending at midnight before a day off is free", () => {
    expect(formClash("2026-10-01T09:00:00+03:00", "2026-10-02T00:00:00+03:00", busy)).toBeNull();
  });

  it("a free stay, and half-filled input, are null", () => {
    expect(formClash("2026-10-07T09:00:00+03:00", "2026-10-08T09:00:00+03:00", busy)).toBeNull();
    expect(formClash("", "", busy)).toBeNull();
    expect(formClash("2026-10-01T09:00:00+03:00", "", busy)).toBeNull();
  });
});

describe("monthGrid", () => {
  it("October 2026 starts on a Thursday, so three blanks come first (Monday-first)", () => {
    const g = monthGrid(2026, 9);
    expect(g.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(g.length % 7).toBe(0);
    expect(g.filter(Boolean)).toHaveLength(31);
    expect(g.filter(Boolean).at(-1)).toBe("2026-10-31");
  });

  it("a month starting on Monday has no leading blanks", () => {
    // 1 June 2026 is a Monday.
    expect(monthGrid(2026, 5)[0]).toBe("2026-06-01");
  });

  it("knows February's length", () => {
    expect(monthGrid(2028, 1).filter(Boolean)).toHaveLength(29);
    expect(monthGrid(2026, 1).filter(Boolean)).toHaveLength(28);
  });

  it("rolls a month index past December into the next year", () => {
    expect(monthGrid(2026, 12).filter(Boolean)[0]).toBe("2027-01-01");
  });
});

describe("problemFromHint", () => {
  it("maps the two database hints and ignores the rest", () => {
    expect(problemFromHint("sitter_unavailable")).toBe("sitter_unavailable");
    expect(problemFromHint("already_booked")).toBe("already_booked");
    expect(problemFromHint("price_changed")).toBeNull();
    expect(problemFromHint(undefined)).toBeNull();
    expect(problemFromHint(null)).toBeNull();
  });
});

describe("acceptClashKey", () => {
  // Review I4 (2026-09-26): the owner agreeing to a counter-offer was shown the sitter's copy.
  it("tells the sitter to free their own days", () => {
    expect(acceptClashKey("sitter_unavailable", "sitter", "appPages.bookings")).toBe("appPages.bookings.sitterUnavailable");
    expect(acceptClashKey("already_booked", "sitter", "messages.offer")).toBe("messages.offer.alreadyBooked");
  });

  it("tells the owner the sitter isn't free, whichever page they accepted on", () => {
    expect(acceptClashKey("sitter_unavailable", "owner", "appPages.bookings")).toBe("appPages.bookingsNew.sitterUnavailable");
    expect(acceptClashKey("already_booked", "owner", "messages.offer")).toBe("appPages.bookingsNew.alreadyBooked");
  });
});
