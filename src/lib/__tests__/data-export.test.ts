import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectMyData, exportFilename, EXPORT_PAGE } from "@/lib/data-export";

/**
 * "Download my data" (GDPR art. 15 and 20): everything the signed-in person can read about
 * themselves, a page at a time, with the collar's secrets left out. Each query is recorded
 * as [table, op, ...args] so the assertions read which filter each section uses.
 */

const h = vi.hoisted(() => ({
  calls: [] as unknown[][],
  rows: {} as Record<string, Record<string, unknown>[]>,
  failOn: null as string | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "eq", "or", "in", "order"]) {
        chain[op] = (...args: unknown[]) => {
          h.calls.push([table, op, ...args]);
          return chain;
        };
      }
      const result = (from: number, to: number) => ({
        data: (h.rows[table] ?? []).slice(from, to + 1),
        error: h.failOn === table ? { message: "permission denied" } : null,
      });
      chain.range = (from: number, to: number) => {
        h.calls.push([table, "range", from, to]);
        return Promise.resolve(result(from, to));
      };
      chain.maybeSingle = () => Promise.resolve({ data: h.rows[table]?.[0] ?? null, error: h.failOn === table ? { message: "x" } : null });
      return chain;
    },
  },
}));

const USER = { id: "u1", email: "owner@example.test" };
const calls = (table: string) => h.calls.filter((c) => c[0] === table).map((c) => c.slice(1));

beforeEach(() => {
  h.calls = [];
  h.failOn = null;
  h.rows = {
    my_profile: [{ id: "u1", full_name: "Rūta" }],
    pets: [{ id: "p1", name: "Rex", archived_at: "2026-10-01T00:00:00Z" }],
    bookings: [{ id: "b1" }, { id: "b2" }],
    messages: [{ id: "m1", booking_id: "b1" }],
    reviews: [{ id: "r1" }],
    favorites: [{ sitter_id: "s1" }],
    notifications: [{ id: "n1" }],
    sitter_days_off: [],
    collar_devices: [{ id: "c1", label: "Rex" }],
    collar_locations: [{ device_id: "c1", lat: 54.7, lng: 25.3 }],
  };
});

describe("collectMyData", () => {
  it("gathers every section about the person, archived pets included", async () => {
    const data = await collectMyData(USER, new Date("2026-10-10T12:00:00Z"));
    expect(data.exportedAt).toBe("2026-10-10T12:00:00.000Z");
    expect(data.account).toEqual({ id: "u1", email: "owner@example.test" });
    expect(data.profile).toEqual({ id: "u1", full_name: "Rūta" });
    expect(data.pets).toHaveLength(1);
    expect(data.bookings).toHaveLength(2);
    expect(data.messages).toHaveLength(1);
    expect(data.reviews).toHaveLength(1);
    expect(data.savedSitters).toHaveLength(1);
    expect(data.notifications).toHaveLength(1);
    expect(data.daysOff).toEqual([]);
    expect(data.collars).toHaveLength(1);
    expect(data.collarLocations).toHaveLength(1);
  });

  it("asks for each section by the person's own id", async () => {
    await collectMyData(USER);
    expect(calls("pets")).toContainEqual(["eq", "owner_id", "u1"]);
    expect(calls("pets").some((c) => c[0] === "is")).toBe(false);
    expect(calls("bookings")).toContainEqual(["or", "owner_id.eq.u1,sitter_id.eq.u1"]);
    expect(calls("messages")).toContainEqual(["in", "booking_id", ["b1", "b2"]]);
    expect(calls("reviews")).toContainEqual(["or", "author_id.eq.u1,subject_id.eq.u1"]);
    expect(calls("favorites")).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls("notifications")).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls("sitter_days_off")).toContainEqual(["eq", "sitter_id", "u1"]);
    expect(calls("collar_devices")).toContainEqual(["eq", "owner_id", "u1"]);
    expect(calls("collar_locations")).toContainEqual(["in", "device_id", ["c1"]]);
  });

  it("never exports a collar's secret or pairing code", async () => {
    await collectMyData(USER);
    const columns = String(calls("collar_devices").find((c) => c[0] === "select")?.[1]);
    expect(columns).not.toMatch(/secret|pair_code/);
    expect(columns).not.toBe("*");
  });

  it("reads past the API's 1000-row page", async () => {
    h.rows.collar_locations = Array.from({ length: EXPORT_PAGE + 5 }, (_, i) => ({ device_id: "c1", i }));
    const data = await collectMyData(USER);
    expect(data.collarLocations).toHaveLength(EXPORT_PAGE + 5);
    expect(calls("collar_locations").filter((c) => c[0] === "range")).toEqual([
      ["range", 0, EXPORT_PAGE - 1],
      ["range", EXPORT_PAGE, 2 * EXPORT_PAGE - 1],
    ]);
  });

  it("skips messages and fixes when there are no bookings or collars", async () => {
    h.rows.bookings = [];
    h.rows.collar_devices = [];
    const data = await collectMyData(USER);
    expect(data.messages).toEqual([]);
    expect(data.collarLocations).toEqual([]);
    expect(calls("messages")).toEqual([]);
    expect(calls("collar_locations")).toEqual([]);
  });

  it("fails as a whole rather than hand over a partial copy", async () => {
    h.failOn = "reviews";
    await expect(collectMyData(USER)).rejects.toThrow();
  });
});

describe("exportFilename", () => {
  it("names the file after the day it was made", () => {
    expect(exportFilename(new Date("2026-10-10T23:30:00Z"))).toBe("petbnb-my-data-2026-10-10.json");
  });
});
