import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  bookingAllowsWalk, loadBookingWalks, loadDeviceWalks, loadWalk, parseWalk, startWalk, stopWalk,
  walkErrorKey, walkLiveState, walkStats, WALK_EARLY_START_MS, type WalkDetail,
} from "@/lib/collar/walks";

const h = vi.hoisted(() => ({
  rpcResult: { data: null as unknown, error: null as null | { message: string } },
  calls: [] as unknown[][],
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: async (...args: unknown[]) => {
      h.calls.push(args);
      return h.rpcResult;
    },
  },
}));

beforeEach(() => {
  h.rpcResult = { data: null, error: null };
  h.calls = [];
});

const rawWalk = (over: Record<string, unknown> = {}) => ({
  id: "w1", device_id: "c1", booking_id: null, walker_id: "u1", walker_name: "Lukas", walked_by_me: true,
  started_at: "2026-10-22T10:00:00+00:00", ended_at: null, end_reason: null,
  points: [
    { lat: 54.9, lng: 23.9, speed_kmh: 4, recorded_at: "2026-10-22T10:00:10+00:00" },
    { lat: 54.91, lng: 23.9, speed_kmh: null, recorded_at: "2026-10-22T10:10:00+00:00" },
  ],
  ...over,
});

const booking = (over: Record<string, unknown> = {}) => ({
  status: "signed", service: "boarding", start_at: "2026-10-22T12:00:00Z", end_at: "2026-10-24T12:00:00Z", ...over,
});

describe("bookingAllowsWalk", () => {
  const start = Date.parse("2026-10-22T12:00:00Z");

  it("opens an hour before the stay starts", () => {
    expect(bookingAllowsWalk(booking(), start - WALK_EARLY_START_MS)).toBe(true);
    expect(bookingAllowsWalk(booking(), start - WALK_EARLY_START_MS - 1)).toBe(false);
  });

  it("closes when the stay ends", () => {
    expect(bookingAllowsWalk(booking(), Date.parse("2026-10-24T11:59:59Z"))).toBe(true);
    expect(bookingAllowsWalk(booking(), Date.parse("2026-10-24T12:00:00Z"))).toBe(false);
  });

  it("needs a signed walking, boarding or daycare booking", () => {
    for (const service of ["walking", "boarding", "daycare"]) expect(bookingAllowsWalk(booking({ service }), start)).toBe(true);
    expect(bookingAllowsWalk(booking({ service: "grooming" }), start)).toBe(false);
    expect(bookingAllowsWalk(booking({ status: "pending" }), start)).toBe(false);
    expect(bookingAllowsWalk(booking({ status: "completed" }), start)).toBe(false);
  });
});

describe("walkStats", () => {
  it("counts a running walk up to now", () => {
    const stats = walkStats(parseWalk(rawWalk()), Date.parse("2026-10-22T10:30:00Z"));
    expect(stats.durationMin).toBe(30);
    expect(stats.distanceKm).toBeCloseTo(1.11, 1);
  });

  it("counts a saved walk up to its end", () => {
    const stats = walkStats(parseWalk(rawWalk({ ended_at: "2026-10-22T10:12:00+00:00", end_reason: "stopped" })), Date.parse("2026-10-23T00:00:00Z"));
    expect(stats.durationMin).toBe(12);
  });

  it("reads no points as no distance", () => {
    expect(walkStats(parseWalk(rawWalk({ points: [] })), Date.parse("2026-10-22T10:05:00Z")).distanceKm).toBe(0);
  });
});

describe("parseWalk", () => {
  it("keeps the fields the screens use and defaults the missing ones", () => {
    const walk = parseWalk({ ...rawWalk(), walker_name: undefined, points: null });
    expect(walk).toMatchObject({ id: "w1", device_id: "c1", walker_name: null, walked_by_me: true, ended_at: null, points: [] });
  });
});

describe("walkLiveState", () => {
  const detail = (over: Partial<WalkDetail["walk"]> = {}, lastSeen: string | null = "2026-10-22T10:10:00Z"): WalkDetail => ({
    walk: { ...parseWalk(rawWalk()), ...over },
    collar: { label: null, last_seen_at: lastSeen, gps_locked: true, gps_satellites: 6 },
    pet_name: null, is_owner: true, can_stop: true,
  });

  it("is live while the last fix is under 45 s old", () => {
    expect(walkLiveState(detail(), Date.parse("2026-10-22T10:10:40Z"))).toBe("live");
  });

  it("is searching while the collar checks in without a fresh fix", () => {
    expect(walkLiveState(detail(), Date.parse("2026-10-22T10:11:00Z"))).toBe("searching");
  });

  it("is offline once the collar is silent for 90 s", () => {
    expect(walkLiveState(detail(), Date.parse("2026-10-22T10:12:00Z"))).toBe("offline");
  });

  it("is ended for a saved walk", () => {
    expect(walkLiveState(detail({ ended_at: "2026-10-22T10:10:00Z", end_reason: "stopped" }), Date.parse("2026-10-22T10:10:01Z"))).toBe("ended");
  });
});

describe("walkErrorKey", () => {
  it("names the two refusals the database gives", () => {
    expect(walkErrorKey(new Error("walk_running"))).toBe("walk_running");
    expect(walkErrorKey(new Error("not_allowed"))).toBe("not_allowed");
    expect(walkErrorKey(new Error("Failed to fetch"))).toBe("failed");
    expect(walkErrorKey("odd")).toBe("failed");
  });
});

describe("walk RPCs", () => {
  it("starts an owner's walk without a booking", async () => {
    h.rpcResult = { data: "w9", error: null };
    expect(await startWalk("c1")).toBe("w9");
    expect(h.calls[0]).toEqual(["start_collar_walk", { p_device_id: "c1" }]);
  });

  it("starts a sitter's walk on the booking", async () => {
    h.rpcResult = { data: "w9", error: null };
    await startWalk("c1", "b1");
    expect(h.calls[0]).toEqual(["start_collar_walk", { p_device_id: "c1", p_booking_id: "b1" }]);
  });

  it("throws the database's message", async () => {
    h.rpcResult = { data: null, error: { message: "walk_running" } };
    await expect(startWalk("c1")).rejects.toThrow("walk_running");
  });

  it("stops a walk and says whether it was saved", async () => {
    h.rpcResult = { data: "dropped", error: null };
    expect(await stopWalk("w1")).toBe("dropped");
    expect(h.calls[0]).toEqual(["stop_collar_walk", { p_walk_id: "w1" }]);
  });

  it("loads a collar's running and recent walks", async () => {
    h.rpcResult = { data: { running: rawWalk(), recent: [rawWalk({ id: "w0", ended_at: "2026-10-21T10:00:00Z", end_reason: "stopped" })] }, error: null };
    const walks = await loadDeviceWalks("c1");
    expect(h.calls[0]).toEqual(["collar_walks_for_device", { p_device_id: "c1" }]);
    expect(walks.running?.id).toBe("w1");
    expect(walks.recent.map((w) => w.id)).toEqual(["w0"]);
  });

  it("loads a booking's collars and walks for its sitter", async () => {
    h.rpcResult = { data: { collars: [{ id: "c1", label: "Antkaklis" }], running: null, recent: [] }, error: null };
    const walks = await loadBookingWalks("b1");
    expect(h.calls[0]).toEqual(["collar_walks_for_booking", { p_booking_id: "b1" }]);
    expect(walks).toEqual({ collars: [{ id: "c1", label: "Antkaklis" }], running: null, recent: [] });
  });

  it("loads one walk, or null when it is not the caller's", async () => {
    h.rpcResult = { data: { walk: rawWalk(), collar: null, pet_name: "Rudis", is_owner: false, can_stop: true }, error: null };
    expect((await loadWalk("w1"))?.pet_name).toBe("Rudis");
    expect(h.calls[0]).toEqual(["get_collar_walk", { p_walk_id: "w1" }]);
    h.rpcResult = { data: null, error: null };
    expect(await loadWalk("w1")).toBeNull();
  });
});
