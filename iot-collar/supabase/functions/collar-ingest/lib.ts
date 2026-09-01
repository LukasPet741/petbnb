// Pure payload validation for the collar-ingest Edge Function.
//
// Split out of index.ts so it can be unit-tested: index.ts calls Deno.serve at
// module scope and imports npm: specifiers, so importing it from a test would
// start a server. This file touches nothing outside its arguments.
//
// IMPORTANT: this reproduces the CURRENT validation exactly, including its
// gaps. See lib.test.ts, which pins each gap as a documented bug. Tightening
// the rules is a deliberate follow-up, not part of this extraction.

export interface IngestPayload {
  device_id?: string;
  device_secret?: string;
  lat?: number;
  lng?: number;
  speed_kmh?: number | null;
  battery_pct?: number | null;
  recorded_at?: string;
}

export interface ValidatedFix {
  device_id: string;
  device_secret: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  battery_pct: number | null;
  recorded_at: string | undefined;
}

export type ValidationResult =
  | { ok: true; value: ValidatedFix }
  | { ok: false; error: string };

export const REQUIRED_FIELDS_ERROR =
  "device_id, device_secret, lat, lng are required";

/**
 * Mirrors the original inline guard:
 *   !device_id || !device_secret || typeof lat !== "number" || typeof lng !== "number"
 *
 * Note what this does NOT check, all pinned as bugs in the test file:
 * finiteness (NaN and Infinity are typeof "number"), latitude/longitude range,
 * null island, speed_kmh and battery_pct types or ranges, and recorded_at being
 * a parseable timestamp.
 */
export function validateIngestPayload(body: IngestPayload): ValidationResult {
  const {
    device_id,
    device_secret,
    lat,
    lng,
    speed_kmh = null,
    battery_pct = null,
    recorded_at,
  } = body;

  if (
    !device_id ||
    !device_secret ||
    typeof lat !== "number" ||
    typeof lng !== "number"
  ) {
    return { ok: false, error: REQUIRED_FIELDS_ERROR };
  }

  return {
    ok: true,
    value: { device_id, device_secret, lat, lng, speed_kmh, battery_pct, recorded_at },
  };
}
