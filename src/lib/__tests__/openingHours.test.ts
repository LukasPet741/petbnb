import { describe, it, expect } from "vitest";
import { formatHours, isOpenAt, parseOpeningHours } from "@/lib/openingHours";

/** A moment in Vilnius: 2026-10-26 is a Monday. */
const at = (day: number, time: string) => {
  const [h, m] = time.split(":").map(Number);
  // Vilnius is UTC+2 in late October 2026 (after the 25 Oct change).
  return new Date(Date.UTC(2026, 9, 26 + day, h - 2, m));
};
const MON = 0, SAT = 5, SUN = 6;

describe("parseOpeningHours", () => {
  it("reads weekday ranges and a Saturday", () => {
    const s = parseOpeningHours("Mo-Fr 09:00-18:00; Sa 10:00-14:00")!;
    expect(s[MON]).toEqual([[540, 1080]]);
    expect(s[SAT]).toEqual([[600, 840]]);
    expect(s[SUN]).toEqual([]);
  });

  it("accepts commas between rules and an explicit day off", () => {
    const s = parseOpeningHours("Mo-Fr 11:00-20:00, Sa 10:00-18:00, Su off")!;
    expect(s[SAT]).toEqual([[600, 1080]]);
    expect(s[SUN]).toEqual([]);
  });

  it("reads a time with no days as every day, and 24/7 as always", () => {
    expect(parseOpeningHours("8:30-20:00")![SUN]).toEqual([[510, 1200]]);
    expect(parseOpeningHours("24/7")![MON]).toEqual([[0, 1440]]);
  });

  it("lets a later rule override an earlier one for its days", () => {
    expect(parseOpeningHours("Mo-Su 09:00-20:00; Su off")![SUN]).toEqual([]);
  });

  it("reads split hours and day lists", () => {
    const s = parseOpeningHours("Mo,We 09:00-13:00,14:00-18:00")!;
    expect(s[MON]).toEqual([[540, 780], [840, 1080]]);
    expect(s[1]).toEqual([]);
  });

  it("gives up on anything it does not understand, rather than guess", () => {
    expect(parseOpeningHours("Mo-Fr 09:00-18:00; PH off; week 1-53 sunrise-sunset")).toBeNull();
    expect(parseOpeningHours("by appointment")).toBeNull();
    expect(parseOpeningHours("")).toBeNull();
  });
});

describe("isOpenAt", () => {
  const s = parseOpeningHours("Mo-Fr 09:00-18:00; Sa 10:00-14:00")!;

  it("is open inside the hours and closed outside, in Vilnius time", () => {
    expect(isOpenAt(s, at(MON, "09:00"))).toBe(true);
    expect(isOpenAt(s, at(MON, "17:59"))).toBe(true);
    expect(isOpenAt(s, at(MON, "18:00"))).toBe(false);
    expect(isOpenAt(s, at(SUN, "12:00"))).toBe(false);
  });

  it("follows hours past midnight into the next day", () => {
    const late = parseOpeningHours("Fr 20:00-02:00")!;
    expect(isOpenAt(late, at(4, "23:30"))).toBe(true);
    expect(isOpenAt(late, at(SAT, "01:00"))).toBe(true);
    expect(isOpenAt(late, at(SAT, "03:00"))).toBe(false);
  });
});

describe("formatHours", () => {
  it("groups equal days and names them in the visitor's language", () => {
    const s = parseOpeningHours("Mo-Fr 09:00-18:00; Sa 10:00-14:00")!;
    expect(formatHours(s, "en")).toBe("Mon–Fri 09:00–18:00 · Sat 10:00–14:00");
  });

  it("says every day when every day is the same", () => {
    expect(formatHours(parseOpeningHours("Mo-Su 07:30-19:30")!, "en")).toBe("Every day 07:30–19:30");
    expect(formatHours(parseOpeningHours("Mo-Su 07:30-19:30")!, "lt")).toBe("Kasdien 07:30–19:30");
  });
});

describe("the places' own hours", async () => {
  const { ALL_PLACES, PARTNERS, isOpenNow } = await import("@/lib/partners");

  it("reads most of the hours OpenStreetMap gives", () => {
    const given = ALL_PLACES.flatMap((p) => p.locations).filter((l) => l.openingHours);
    const read = given.filter((l) => parseOpeningHours(l.openingHours));
    expect(given.length).toBeGreaterThan(50);
    expect(read.length / given.length).toBeGreaterThan(0.85);
  });

  it("finds Dogiday open on a Monday morning and closed at night", () => {
    const dogiday = PARTNERS.find((p) => p.slug === "dogiday")!;
    expect(isOpenNow(dogiday, at(MON, "10:00"))).toBe(true);
    expect(isOpenNow(dogiday, at(MON, "22:00"))).toBe(false);
  });
});
