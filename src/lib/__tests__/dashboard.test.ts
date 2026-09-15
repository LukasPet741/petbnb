import { describe, it, expect } from "vitest";
import { pickHero, waitingList, groupByDay, dayLabel, type DashBooking } from "@/lib/dashboard";
import type { AppNotification } from "@/lib/types";

/**
 * The dashboard leads with the one thing that needs the visitor now (variant A, 2026-09-15),
 * after the research: a request to answer beats a booking tomorrow, which beats a request
 * still waiting on someone else.
 */

const NOW = Date.parse("2026-09-15T08:00:00+03:00");
const at = (iso: string) => new Date(iso).toISOString();

const booking = (over: Partial<DashBooking>): DashBooking => ({
  id: "b",
  status: "signed",
  service: "walking",
  start_at: at("2026-09-16T09:00:00+03:00"),
  end_at: at("2026-09-16T10:00:00+03:00"),
  pet: { id: "p", name: "Rudis", photo_url: null, type: "dog" },
  counterpart: { id: "c", full_name: "Emilija A.", avatar_url: null },
  ...over,
});

describe("pickHero", () => {
  it("leads with a request the visitor has to answer as a sitter, counting all of them", () => {
    const hero = pickHero({
      owner: [booking({ id: "next", status: "signed" })],
      sitter: [
        booking({ id: "later", status: "pending", start_at: at("2026-09-20T09:00:00+03:00") }),
        booking({ id: "soonest", status: "pending", start_at: at("2026-09-17T09:00:00+03:00") }),
      ],
      now: NOW,
    });
    expect(hero).toMatchObject({ kind: "answer", booking: { id: "soonest" }, count: 2 });
  });

  it("otherwise shows the soonest confirmed booking, on either side, with the visitor's role", () => {
    const hero = pickHero({
      owner: [booking({ id: "owner-later", start_at: at("2026-09-18T09:00:00+03:00") })],
      sitter: [booking({ id: "sitter-sooner", start_at: at("2026-09-16T07:00:00+03:00") })],
      now: NOW,
    });
    expect(hero).toMatchObject({ kind: "next", booking: { id: "sitter-sooner" }, role: "sitter" });
  });

  it("ignores bookings that have already started, and ones that are not live", () => {
    const hero = pickHero({
      owner: [
        booking({ id: "past", start_at: at("2026-09-14T09:00:00+03:00") }),
        booking({ id: "done", status: "completed" }),
        booking({ id: "gone", status: "cancelled" }),
      ],
      sitter: [booking({ id: "old-request", status: "pending", start_at: at("2026-09-10T09:00:00+03:00") })],
      now: NOW,
    });
    expect(hero).toEqual({ kind: "empty" });
  });

  it("falls back to the visitor's own request that a sitter has not answered yet", () => {
    const hero = pickHero({ owner: [booking({ id: "mine", status: "pending" })], sitter: [], now: NOW });
    expect(hero).toMatchObject({ kind: "awaiting", booking: { id: "mine" }, count: 1 });
  });
});

describe("waitingList", () => {
  it("lists live pending requests on both sides, soonest first, without the one the hero shows", () => {
    const owner = [booking({ id: "o1", status: "pending", start_at: at("2026-10-03T09:00:00+03:00") })];
    const sitter = [
      booking({ id: "s1", status: "pending", start_at: at("2026-09-17T09:00:00+03:00") }),
      booking({ id: "s2", status: "pending", start_at: at("2026-09-19T09:00:00+03:00") }),
    ];
    const hero = pickHero({ owner, sitter, now: NOW });

    expect(waitingList({ owner, sitter, hero, now: NOW }).map((w) => [w.booking.id, w.role])).toEqual([
      ["s2", "sitter"],
      ["o1", "owner"],
    ]);
  });

  it("shows at most three", () => {
    const owner = ["a", "b", "c", "d"].map((id, i) =>
      booking({ id, status: "pending", start_at: at(`2026-09-2${i}T09:00:00+03:00`) }),
    );
    expect(waitingList({ owner, sitter: [], hero: { kind: "empty" }, now: NOW })).toHaveLength(3);
  });
});

describe("groupByDay", () => {
  const note = (id: string, created: string) => ({ id, created_at: at(created) }) as AppNotification;

  it("splits notifications into today and earlier by calendar day, keeping order (times safe in UTC and Vilnius)", () => {
    const groups = groupByDay(
      [note("n1", "2026-09-15T07:30:00+03:00"), note("n2", "2026-09-15T06:10:00+03:00"), note("n3", "2026-09-14T20:00:00+03:00")],
      NOW,
    );
    expect(groups.today.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(groups.earlier.map((n) => n.id)).toEqual(["n3"]);
  });

  it("keeps only the newest `limit` notifications", () => {
    const many = Array.from({ length: 9 }, (_, i) => note(`n${i}`, "2026-09-14T10:00:00+03:00"));
    const groups = groupByDay(many, NOW, 6);
    expect(groups.today.length + groups.earlier.length).toBe(6);
  });
});

describe("dayLabel", () => {
  // Found in the visual review 2026-09-15: formatDate() renders Lithuanian as "2026-09-18",
  // which in the hero's large type read like a database value.
  it.each([
    ["lt", /^rugsėjo 18 d\.$/],
    ["en", /^18 September$/],
  ] as const)("names the month in %s, with no year and no machine date", (locale, want) => {
    expect(dayLabel(new Date("2026-09-18T15:00:00+03:00").toISOString(), locale)).toMatch(want);
  });
});
