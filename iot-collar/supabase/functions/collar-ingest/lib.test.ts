import { describe, it, expect } from "vitest";
import {
  validateIngestPayload,
  REQUIRED_FIELDS_ERROR,
  INVALID_FIELDS_ERROR,
  MAX_FUTURE_MS,
  MAX_AGE_MS,
  type IngestPayload,
} from "./lib.ts";

/**
 * Validation for the collar ingest endpoint (v6, 2026-09-26). v5 pinned its gaps as BUG tests;
 * v6 closes them, so those tests now assert rejection. Anything that passes here is written with
 * the service role and drawn on the owner's map as their pet's position.
 */

const NOW = Date.parse("2026-09-26T12:00:00Z");

const valid = (over: Partial<IngestPayload> = {}): IngestPayload => ({
  device_id: "collar-1",
  device_secret: "s3cret",
  lat: 54.6872,
  lng: 25.2797,
  ...over,
});

const checkin = (over: Partial<IngestPayload> = {}): IngestPayload => ({
  device_id: "collar-1",
  device_secret: "s3cret",
  type: "checkin",
  satellites_in_view: 3,
  gps_locked: false,
  ...over,
});

const check = (body: IngestPayload) => validateIngestPayload(body, NOW);

describe("accepted positions", () => {
  it("accepts a well-formed fix and marks it as a fix", () => {
    const result = check(valid());
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === "fix") {
      expect(result.value.lat).toBe(54.6872);
      expect(result.value.lng).toBe(25.2797);
      expect(result.value.device_id).toBe("collar-1");
    } else {
      throw new Error("expected a fix");
    }
  });

  it("treats an explicit type of fix like no type at all", () => {
    const result = check(valid({ type: "fix" }));
    expect(result.ok && result.value.kind).toBe("fix");
  });

  it("defaults speed, battery and satellites to null when the keys are absent", () => {
    const result = check(valid());
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.speed_kmh).toBeNull();
    expect(result.value.battery_pct).toBeNull();
    expect(result.value.satellites).toBeNull();
  });

  it("preserves a supplied speed, battery and satellite count", () => {
    const result = check(valid({ speed_kmh: 4.2, battery_pct: 87, satellites: 7 }));
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.speed_kmh).toBe(4.2);
    expect(result.value.battery_pct).toBe(87);
    expect(result.value.satellites).toBe(7);
  });

  it("preserves a zero speed rather than coercing it to null", () => {
    // A stationary pet is real data; a truthiness check here would erase it.
    const result = check(valid({ speed_kmh: 0, battery_pct: 0 }));
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.speed_kmh).toBe(0);
    expect(result.value.battery_pct).toBe(0);
  });

  it("leaves recorded_at undefined so the caller can stamp the server time", () => {
    const result = check(valid());
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.recorded_at).toBeUndefined();
  });

  it("keeps an explicit null speed as null", () => {
    const result = check(valid({ speed_kmh: null }));
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.speed_kmh).toBeNull();
  });

  it("accepts a fix from yesterday, as a flushed offline queue sends", () => {
    const yesterday = new Date(NOW - 24 * 60 * 60_000).toISOString();
    const result = check(valid({ recorded_at: yesterday }));
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.recorded_at).toBe(yesterday);
  });
});

describe("accepted check-ins", () => {
  it("accepts a check-in without a position", () => {
    const result = check(checkin());
    expect(result).toEqual({
      ok: true,
      value: { kind: "checkin", device_id: "collar-1", device_secret: "s3cret", satellites_in_view: 3, gps_locked: false },
    });
  });

  it("defaults a missing satellite count to null and a missing lock flag to false", () => {
    const result = check({ device_id: "collar-1", device_secret: "s3cret", type: "checkin" });
    expect(result).toEqual({
      ok: true,
      value: { kind: "checkin", device_id: "collar-1", device_secret: "s3cret", satellites_in_view: null, gps_locked: false },
    });
  });
});

describe("rejected payloads", () => {
  it("rejects an empty object", () => {
    expect(check({})).toEqual({ ok: false, error: REQUIRED_FIELDS_ERROR });
  });

  it.each([
    ["device_id", { device_id: undefined }],
    ["device_secret", { device_secret: undefined }],
    ["lat", { lat: undefined }],
    ["lng", { lng: undefined }],
  ])("rejects a payload missing %s", (_label, over) => {
    expect(check(valid(over)).ok).toBe(false);
  });

  it.each([
    ["device_id", { device_id: "" }],
    ["device_secret", { device_secret: "" }],
  ])("rejects an empty-string %s", (_label, over) => {
    expect(check(valid(over)).ok).toBe(false);
  });

  it.each([
    ["a string", "54.7"],
    ["null", null],
    ["a boolean", true],
    ["an object", {}],
  ])("rejects a latitude given as %s", (_label, lat) => {
    expect(check(valid({ lat: lat as number })).ok).toBe(false);
  });

  it("rejects an unknown payload type", () => {
    expect(check(valid({ type: "reboot" }))).toEqual({ ok: false, error: INVALID_FIELDS_ERROR });
  });
});

describe("impossible data is refused (v5's pinned bugs, fixed)", () => {
  it.each([
    ["a NaN latitude", { lat: NaN }],
    ["a NaN longitude", { lng: NaN }],
    ["an infinite latitude", { lat: Infinity }],
    ["a negative infinite latitude", { lat: -Infinity }],
    ["latitude 91", { lat: 91 }],
    ["latitude -91", { lat: -91 }],
    ["longitude 181", { lng: 181 }],
    ["longitude -5000", { lng: -5000 }],
    ["null island", { lat: 0, lng: 0 }],
    ["a non-numeric speed", { speed_kmh: "fast" as unknown as number }],
    ["a negative speed", { speed_kmh: -1 }],
    ["a speed over 200 km/h", { speed_kmh: 250 }],
    ["a battery above 100", { battery_pct: 9999 }],
    ["a negative battery", { battery_pct: -5 }],
    ["a fractional battery", { battery_pct: 50.5 }],
    ["65 satellites", { satellites: 65 }],
    ["a fractional satellite count", { satellites: 3.5 }],
  ])("rejects %s", (_label, over) => {
    expect(check(valid(over))).toEqual({ ok: false, error: INVALID_FIELDS_ERROR });
  });

  it.each([
    ["an unparseable timestamp", "not-a-timestamp"],
    ["a timestamp from 1999", "1999-01-01T00:00:00Z"],
    ["a far-future timestamp", "2099-01-01T00:00:00Z"],
    ["a timestamp just past the future limit", new Date(NOW + MAX_FUTURE_MS + 1000).toISOString()],
    ["a timestamp just past the age limit", new Date(NOW - MAX_AGE_MS - 1000).toISOString()],
  ])("rejects %s", (_label, recorded_at) => {
    expect(check(valid({ recorded_at }))).toEqual({ ok: false, error: INVALID_FIELDS_ERROR });
  });

  it.each([
    ["65 satellites in view", { satellites_in_view: 65 }],
    ["a negative satellite count", { satellites_in_view: -1 }],
    ["a lock flag that is not a boolean", { gps_locked: "yes" as unknown as boolean }],
  ])("rejects a check-in with %s", (_label, over) => {
    expect(check(checkin(over))).toEqual({ ok: false, error: INVALID_FIELDS_ERROR });
  });
});
