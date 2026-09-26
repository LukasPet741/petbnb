// Pure payload validation for the collar-ingest Edge Function (v6, 2026-09-26).
//
// Split out of index.ts so it can be unit-tested: index.ts calls Deno.serve at module scope and
// imports npm: specifiers, so importing it from a test would start a server. This file touches
// nothing outside its arguments.
//
// Two payloads share the device credentials. A position (no type, or type "fix") carries lat/lng;
// a check-in (type "checkin") says the collar is online and how many satellites it can see, which
// is what the site shows indoors, where the GPS never locks.

export interface IngestPayload {
  type?: string;
  device_id?: string;
  device_secret?: string;
  lat?: number;
  lng?: number;
  speed_kmh?: number | null;
  battery_pct?: number | null;
  satellites?: number | null;
  recorded_at?: string;
  satellites_in_view?: number | null;
  gps_locked?: boolean;
}

export interface ValidatedFix {
  kind: "fix";
  device_id: string;
  device_secret: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  battery_pct: number | null;
  satellites: number | null;
  recorded_at: string | undefined;
}

export interface ValidatedCheckin {
  kind: "checkin";
  device_id: string;
  device_secret: string;
  satellites_in_view: number | null;
  gps_locked: boolean;
}

export type ValidationResult =
  | { ok: true; value: ValidatedFix | ValidatedCheckin }
  | { ok: false; error: string };

export const REQUIRED_FIELDS_ERROR = "device_id, device_secret, lat, lng are required";
export const INVALID_FIELDS_ERROR = "a field is missing or out of range";

/** A Pi clock a little ahead is fine; minutes ahead is a broken clock. */
export const MAX_FUTURE_MS = 5 * 60_000;
/** The Pi's offline queue can hold a walk for a while, not for weeks. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

const MAX_SPEED_KMH = 200;

const invalid = { ok: false as const, error: INVALID_FIELDS_ERROR };

function optionalNumber(value: unknown, ok: (n: number) => boolean): number | null | "bad" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || !ok(value)) return "bad";
  return value;
}

const satelliteCount = (n: number) => Number.isInteger(n) && n >= 0 && n <= 64;

export function validateIngestPayload(body: IngestPayload, now: number = Date.now()): ValidationResult {
  const { type, device_id, device_secret } = body;
  if (!device_id || !device_secret || typeof device_id !== "string" || typeof device_secret !== "string") {
    return { ok: false, error: REQUIRED_FIELDS_ERROR };
  }

  if (type === "checkin") {
    const satellites_in_view = optionalNumber(body.satellites_in_view, satelliteCount);
    if (satellites_in_view === "bad") return invalid;
    const locked = body.gps_locked ?? false;
    if (typeof locked !== "boolean") return invalid;
    return { ok: true, value: { kind: "checkin", device_id, device_secret, satellites_in_view, gps_locked: locked } };
  }
  if (type !== undefined && type !== "fix") return invalid;

  const { lat, lng, recorded_at } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { ok: false, error: REQUIRED_FIELDS_ERROR };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return invalid;
  // The Pi drops an empty NMEA position as 0,0; the server now agrees.
  if (lat === 0 && lng === 0) return invalid;

  const speed_kmh = optionalNumber(body.speed_kmh, (n) => n >= 0 && n <= MAX_SPEED_KMH);
  const battery_pct = optionalNumber(body.battery_pct, (n) => Number.isInteger(n) && n >= 0 && n <= 100);
  const satellites = optionalNumber(body.satellites, satelliteCount);
  if (speed_kmh === "bad" || battery_pct === "bad" || satellites === "bad") return invalid;

  if (recorded_at !== undefined) {
    const at = typeof recorded_at === "string" ? Date.parse(recorded_at) : NaN;
    if (Number.isNaN(at) || at > now + MAX_FUTURE_MS || at < now - MAX_AGE_MS) return invalid;
  }

  return {
    ok: true,
    value: { kind: "fix", device_id, device_secret, lat, lng, speed_kmh, battery_pct, satellites, recorded_at },
  };
}
