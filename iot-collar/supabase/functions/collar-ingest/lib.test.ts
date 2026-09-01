import { describe, it, expect } from "vitest";
import {
  validateIngestPayload,
  REQUIRED_FIELDS_ERROR,
  type IngestPayload,
} from "./lib.ts";

/**
 * These tests pin the CURRENT validation of the collar ingest endpoint, gaps
 * and all. Several of them assert behaviour that is wrong; each is labelled
 * BUG with the correct behaviour, so the hardening pass has failing
 * expectations to flip rather than starting from nothing.
 *
 * Context that raises the stakes: this endpoint writes to collar_locations
 * using the service role. Anything that gets past validation is stored as
 * fact, and the owner's Profile page draws it on a map as their pet's
 * location history.
 *
 * Not covered here, because they are not in this function: the endpoint
 * returns insertError.message verbatim to the caller, leaking Postgres schema
 * details to anyone holding a device secret; and there is no rate limiting,
 * no replay protection and no idempotency key, so a captured payload can be
 * replayed indefinitely to flood the table.
 */

const valid = (over: Partial<IngestPayload> = {}): IngestPayload => ({
  device_id: "collar-1",
  device_secret: "s3cret",
  lat: 54.6872,
  lng: 25.2797,
  ...over,
});

describe("accepted payloads", () => {
  it("accepts a well-formed fix", () => {
    const result = validateIngestPayload(valid());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lat).toBe(54.6872);
      expect(result.value.lng).toBe(25.2797);
      expect(result.value.device_id).toBe("collar-1");
    }
  });

  it("defaults speed and battery to null when the keys are absent", () => {
    const result = validateIngestPayload(valid());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.speed_kmh).toBeNull();
      expect(result.value.battery_pct).toBeNull();
    }
  });

  it("preserves a supplied speed and battery", () => {
    const result = validateIngestPayload(valid({ speed_kmh: 4.2, battery_pct: 87 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.speed_kmh).toBe(4.2);
      expect(result.value.battery_pct).toBe(87);
    }
  });

  it("preserves a zero speed rather than coercing it to null", () => {
    // A stationary pet is real data; a truthiness check here would erase it.
    const result = validateIngestPayload(valid({ speed_kmh: 0, battery_pct: 0 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.speed_kmh).toBe(0);
      expect(result.value.battery_pct).toBe(0);
    }
  });

  it("leaves recorded_at undefined so the caller can stamp the server time", () => {
    const result = validateIngestPayload(valid());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.recorded_at).toBeUndefined();
  });

  it("applies the null defaults only for undefined, not for an explicit null", () => {
    // A destructuring default fires on undefined only. Both paths happen to
    // end at null here, but the distinction matters if a default ever changes.
    const explicit = validateIngestPayload(valid({ speed_kmh: null }));
    expect(explicit.ok).toBe(true);
    if (explicit.ok) expect(explicit.value.speed_kmh).toBeNull();
  });
});

describe("rejected payloads", () => {
  it("rejects an empty object", () => {
    const result = validateIngestPayload({});
    expect(result).toEqual({ ok: false, error: REQUIRED_FIELDS_ERROR });
  });

  it.each([
    ["device_id", { device_id: undefined }],
    ["device_secret", { device_secret: undefined }],
    ["lat", { lat: undefined }],
    ["lng", { lng: undefined }],
  ])("rejects a payload missing %s", (_label, over) => {
    expect(validateIngestPayload(valid(over)).ok).toBe(false);
  });

  it.each([
    ["device_id", { device_id: "" }],
    ["device_secret", { device_secret: "" }],
  ])("rejects an empty-string %s, because the guard is a truthiness check", (_label, over) => {
    expect(validateIngestPayload(valid(over)).ok).toBe(false);
  });

  it.each([
    ["a string", "54.7"],
    ["null", null],
    ["a boolean", true],
    ["an object", {}],
  ])("rejects a latitude given as %s", (_label, lat) => {
    expect(validateIngestPayload(valid({ lat: lat as number })).ok).toBe(false);
  });

  it("reports a single combined message rather than naming the offending field", () => {
    // Deliberate: the client is a headless device, not a form.
    const result = validateIngestPayload({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(REQUIRED_FIELDS_ERROR);
  });
});

describe("validation gaps (pinned bugs)", () => {
  // BUG: typeof NaN === "number", so a computed NaN from a device with a bad
  // GPS read is accepted and stored. Correct guard: Number.isFinite(lat).
  it.each([
    ["latitude", { lat: NaN }],
    ["longitude", { lng: NaN }],
  ])("accepts a NaN %s (should be rejected)", (_label, over) => {
    expect(validateIngestPayload(valid(over)).ok).toBe(true);
  });

  // BUG: same root cause as NaN.
  it.each([
    ["positive Infinity", Infinity],
    ["negative Infinity", -Infinity],
  ])("accepts a latitude of %s (should be rejected)", (_label, lat) => {
    expect(validateIngestPayload(valid({ lat })).ok).toBe(true);
  });

  // BUG: there is no range check at all. Correct behaviour: latitude within
  // [-90, 90] and longitude within [-180, 180]. As written, a device can
  // report a position that does not exist on Earth and the map will plot it.
  it.each([
    ["latitude", { lat: 91 }],
    ["latitude", { lat: 1000 }],
    ["latitude", { lat: -91 }],
    ["longitude", { lng: 181 }],
    ["longitude", { lng: -5000 }],
  ])("accepts an out-of-range %s (should be rejected)", (_label, over) => {
    expect(validateIngestPayload(valid(over)).ok).toBe(true);
  });

  // BUG: the two layers disagree. The device-side gps_reader.py explicitly
  // discards a fix whose latitude or longitude is 0, treating it as an empty
  // NMEA field, but the server happily accepts null island. Any other client
  // can therefore post (0, 0) and have it drawn on the owner's map.
  it("accepts null island at zero latitude and longitude (device side rejects it)", () => {
    expect(validateIngestPayload(valid({ lat: 0, lng: 0 })).ok).toBe(true);
  });

  // BUG: speed_kmh and battery_pct are passed straight to the insert with no
  // type or range check. A non-numeric speed reaches Postgres and surfaces as
  // a 500 whose body leaks the database error message.
  it.each([
    ["a non-numeric speed", { speed_kmh: "fast" as unknown as number }],
    ["a battery above 100", { battery_pct: 9999 }],
    ["a negative battery", { battery_pct: -5 }],
  ])("accepts %s (should be validated)", (_label, over) => {
    expect(validateIngestPayload(valid(over)).ok).toBe(true);
  });

  // BUG: recorded_at is unvalidated and used verbatim. An authenticated device
  // can backdate or post-date fixes at will, forging location history - which
  // matters because this history is the product's headline feature. A garbage
  // string reaches Postgres and produces a 500 with a leaked error.
  it.each([
    ["a backdated timestamp", "1999-01-01T00:00:00Z"],
    ["a far-future timestamp", "2099-01-01T00:00:00Z"],
    ["an unparseable string", "not-a-timestamp"],
  ])("accepts %s unchecked (should be range-validated)", (_label, recorded_at) => {
    const result = validateIngestPayload(valid({ recorded_at }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.recorded_at).toBe(recorded_at);
  });
});
