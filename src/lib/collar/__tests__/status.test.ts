import { describe, it, expect } from "vitest";
import {
  collarState, isOnline, msSincePaired, shownPosition, LIVE_MAX_AGE_MS, REPLAY_MAX_AGE_MS, SEEN_MAX_AGE_MS,
} from "@/lib/collar/status";
import type { CollarDevice, CollarPosition } from "@/lib/collar/types";

const NOW = Date.parse("2026-09-26T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const device = (over: Partial<CollarDevice> = {}): CollarDevice => ({
  id: "c1", label: "Reksas", is_demo: false, claimed_at: ago(3_600_000), created_at: ago(7_200_000),
  last_seen_at: null, gps_locked: null, gps_satellites: null, ...over,
});

const pos = (msAgo: number, source: "collar" | "replay" = "collar"): CollarPosition => ({
  device_id: "c1", lat: 54.68, lng: 25.23, speed_kmh: 4.2, recorded_at: ago(msAgo), source,
});

function state(over: { device?: CollarDevice | null; latest?: CollarPosition | null; latestReal?: CollarPosition | null; replayingHere?: boolean } = {}) {
  return collarState({
    device: over.device === undefined ? device() : over.device,
    latest: over.latest ?? null,
    latestReal: over.latestReal ?? null,
    replayingHere: over.replayingHere ?? false,
    now: NOW,
  });
}

describe("collarState", () => {
  it("is no_collar without a device", () => {
    expect(state({ device: null })).toBe("no_collar");
  });

  it("is replaying while this tab plays a walk, whatever else is true", () => {
    expect(state({ device: device({ is_demo: true }), replayingHere: true })).toBe("replaying");
    expect(state({ device: device({ last_seen_at: ago(600_000) }), replayingHere: true })).toBe("replaying");
  });

  it("is replaying when the newest position is a replay at most 10 s old (another tab plays it)", () => {
    expect(state({ latest: pos(REPLAY_MAX_AGE_MS, "replay") })).toBe("replaying");
    expect(state({ latest: pos(REPLAY_MAX_AGE_MS + 1, "replay") })).not.toBe("replaying");
  });

  it("is demo_idle for a demo collar that is not replaying", () => {
    expect(state({ device: device({ is_demo: true }), latest: pos(60_000, "replay") })).toBe("demo_idle");
  });

  it("is live with a real position at most 45 s old", () => {
    const seen = device({ last_seen_at: ago(1_000) });
    expect(state({ device: seen, latestReal: pos(LIVE_MAX_AGE_MS) })).toBe("live");
    expect(state({ device: seen, latestReal: pos(LIVE_MAX_AGE_MS + 1) })).toBe("searching");
  });

  it("is searching while the collar checked in within 90 s", () => {
    expect(state({ device: device({ last_seen_at: ago(SEEN_MAX_AGE_MS) }) })).toBe("searching");
  });

  it("is offline once a collar seen since pairing has been silent over 90 s", () => {
    expect(state({ device: device({ last_seen_at: ago(SEEN_MAX_AGE_MS + 1) }) })).toBe("offline");
  });

  it("is waiting while a paired collar has never checked in", () => {
    expect(state({ device: device({ last_seen_at: null }) })).toBe("waiting");
  });

  it("is waiting when the last check-in predates the pairing", () => {
    expect(state({ device: device({ claimed_at: ago(60_000), last_seen_at: ago(7_200_000) }) })).toBe("waiting");
  });

  it("counts a check-in just before pairing as online", () => {
    expect(state({ device: device({ claimed_at: ago(5_000), last_seen_at: ago(10_000) }) })).toBe("searching");
  });

  it("uses created_at for a collar paired before claim codes existed", () => {
    const legacy = device({ claimed_at: null, created_at: ago(60_000), last_seen_at: ago(120_000) });
    expect(state({ device: legacy })).toBe("waiting");
  });
});

describe("helpers", () => {
  it("measures time since pairing", () => {
    expect(msSincePaired(device({ claimed_at: ago(91_000) }), NOW)).toBe(91_000);
  });

  it("knows whether a collar is online", () => {
    expect(isOnline(device({ last_seen_at: ago(90_000) }), NOW)).toBe(true);
    expect(isOnline(device({ last_seen_at: ago(90_001) }), NOW)).toBe(false);
    expect(isOnline(device({ last_seen_at: null }), NOW)).toBe(false);
  });
});

describe("shownPosition", () => {
  // Review I2 (2026-09-26): after a replay on a real collar, its last point stayed on the map and in
  // the sidebar as if it were where the collar is, with "looking for satellites" beside it.
  const real: CollarPosition = { device_id: "c1", lat: 54.70, lng: 25.30, speed_kmh: 0, recorded_at: ago(3_600_000), source: "collar" };
  const replayEnd: CollarPosition = { device_id: "c1", lat: 54.68, lng: 25.23, speed_kmh: 4, recorded_at: ago(5_000), source: "replay" };

  it("shows the replay's point only while it plays", () => {
    expect(shownPosition("replaying", device(), replayEnd, real)).toBe(replayEnd);
  });

  it("shows the collar's own last fix once the replay is over, or nothing", () => {
    for (const state of ["searching", "offline", "live", "waiting"] as const) {
      expect(shownPosition(state, device(), replayEnd, real)).toBe(real);
      expect(shownPosition(state, device(), replayEnd, null)).toBeNull();
    }
  });

  it("always shows the demo collar's points, which are all replays", () => {
    expect(shownPosition("demo_idle", device({ is_demo: true }), replayEnd, null)).toBe(replayEnd);
  });
});
