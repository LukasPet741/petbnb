import { haversineKm } from "./stats";

/**
 * "Vingis Park" on the collar's status card, from OpenStreetMap's Nominatim reverse geocoder.
 * Its usage policy allows about one request a second; this asks at most once a minute, and only
 * after the collar moved more than 150 m. Any failure just means no place name.
 */
export const PLACE_MIN_INTERVAL_MS = 60_000;
export const PLACE_MIN_MOVE_KM = 0.15;

interface Remembered {
  at: number;
  lat: number;
  lng: number;
  locale: string;
  name: string | null;
}

interface NominatimReverse {
  name?: string;
  address?: Record<string, string | undefined>;
}

function nameOf(body: NominatimReverse): string | null {
  const a = body.address ?? {};
  return body.name || a.park || a.leisure || a.neighbourhood || a.suburb || a.quarter || a.road || null;
}

export function createPlaceLookup(fetchImpl: typeof fetch = fetch, clock: () => number = Date.now) {
  let last: Remembered | null = null;
  let inflight: Promise<string | null> | null = null;

  return async function lookup(lat: number, lng: number, locale: "en" | "lt"): Promise<string | null> {
    const now = clock();
    if (last && last.locale === locale) {
      const tooSoon = now - last.at < PLACE_MIN_INTERVAL_MS;
      const tooClose = haversineKm(last, { lat, lng }) < PLACE_MIN_MOVE_KM;
      if (tooSoon || tooClose) return last.name;
    }
    if (inflight) return inflight;

    inflight = (async () => {
      try {
        const url =
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16` +
          `&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&accept-language=${locale}`;
        const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`nominatim ${response.status}`);
        last = { at: now, lat, lng, locale, name: nameOf((await response.json()) as NominatimReverse) };
      } catch {
        // Remember the failure too, so a broken lookup is not retried on every position.
        last = { at: now, lat, lng, locale, name: null };
      } finally {
        inflight = null;
      }
      return last.name;
    })();
    return inflight;
  };
}

/** The app-wide lookup, so the throttle holds across components. */
export const lookupPlace = createPlaceLookup();
