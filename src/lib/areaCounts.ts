/**
 * The places map's People layer (PetBnB ecosystem plan, "The map"): sitters as a count per
 * city, never a pin. Profiles store only a city, which is the right level for privacy; an
 * area with fewer than PRIVACY_FLOOR sitters shows nothing, so no one can be singled out.
 */

export const PRIVACY_FLOOR = 5;

export interface AreaCount {
  city: string;
  count: number;
}

export interface AreaCircle extends AreaCount {
  lat: number;
  lng: number;
}

/** City centres (public facts), for the cities PetBnB profiles name. */
const CITY_CENTRES: Record<string, [number, number]> = {
  Vilnius: [54.6872, 25.2797],
  Kaunas: [54.8985, 23.9036],
  "Klaipėda": [55.7033, 21.1443],
  "Šiauliai": [55.9349, 23.3137],
  "Panevėžys": [55.7348, 24.3575],
  Alytus: [54.3963, 24.0459],
  "Marijampolė": [54.5599, 23.354],
  "Mažeikiai": [56.3092, 22.3415],
  Jonava: [55.0727, 24.2797],
  Utena: [55.4977, 25.5992],
  "Kėdainiai": [55.2883, 23.9748],
  "Telšiai": [55.9814, 22.2472],
  "Tauragė": [55.2522, 22.2897],
  "Ukmergė": [55.2454, 24.7761],
  Visaginas: [55.5986, 26.4384],
  Palanga: [55.9175, 21.0686],
  Druskininkai: [54.0158, 23.9851],
  "Trakai": [54.6379, 24.9347],
};

/**
 * Sitters per city, at or above the floor, busiest first. Takes either profile rows (counted
 * here) or the database function's totals; the floor is applied again either way.
 */
export function countByCity(rows: { city: string | null }[], totals?: { city: string; sitters: number }[]): AreaCount[] {
  const counts = new Map<string, number>();
  if (totals) for (const t of totals) counts.set(t.city.trim(), (counts.get(t.city.trim()) ?? 0) + t.sitters);
  for (const r of rows) {
    const city = r.city?.trim();
    if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count >= PRIVACY_FLOOR)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "lt"));
}

export function areaCircles(counts: AreaCount[]): AreaCircle[] {
  return counts.flatMap((c) => {
    const centre = CITY_CENTRES[c.city];
    return centre ? [{ ...c, lat: centre[0], lng: centre[1] }] : [];
  });
}
