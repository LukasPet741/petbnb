import { describe, it, expect } from "vitest";
import { mergePosition } from "@/lib/collar/positions";
import type { CollarPosition } from "@/lib/collar/types";

const at = (iso: string, source: "collar" | "replay" = "collar", device_id = "c1"): CollarPosition => ({
  device_id, lat: 54.68, lng: 25.23, speed_kmh: 4.2, recorded_at: iso, source,
});

describe("mergePosition", () => {
  it("records the first position of a collar as both newest and newest real", () => {
    const p = at("2026-09-26T12:00:00Z");
    expect(mergePosition({}, p)).toEqual({ c1: { latest: p, latestReal: p } });
  });

  it("replaces an older position with a newer one", () => {
    const old = at("2026-09-26T12:00:00Z");
    const fresh = at("2026-09-26T12:00:15Z");
    const merged = mergePosition({ c1: { latest: old, latestReal: old } }, fresh);
    expect(merged.c1).toEqual({ latest: fresh, latestReal: fresh });
  });

  it("ignores a position older than the one it has (a flushed offline queue)", () => {
    const fresh = at("2026-09-26T12:00:15Z");
    const prev = { c1: { latest: fresh, latestReal: fresh } };
    expect(mergePosition(prev, at("2026-09-26T11:50:00Z"))).toBe(prev);
  });

  it("lets a replayed point become the newest without becoming the newest real one", () => {
    const real = at("2026-09-26T12:00:00Z");
    const replayed = at("2026-09-26T12:00:02Z", "replay");
    const merged = mergePosition({ c1: { latest: real, latestReal: real } }, replayed);
    expect(merged.c1).toEqual({ latest: replayed, latestReal: real });
  });

  it("keeps collars apart", () => {
    const merged = mergePosition({}, at("2026-09-26T12:00:00Z", "collar", "c2"));
    expect(Object.keys(merged)).toEqual(["c2"]);
  });
});
