import { SERVICE_LABELS, type Profile, type ServiceType } from "@/lib/types";
import { normaliseCity } from "@/lib/utils";

export type SortKey = "experience" | "price" | "active";
export const SORT_KEYS: SortKey[] = ["experience", "price", "active"];

/** The hourly caps the price chip offers; null means any price. */
export const PRICE_CAPS = [15, 20, 25, 30] as const;

/** Higher first, with a missing value always last whichever way the list sorts. */
const byDesc = (value: (p: Profile) => number | null) => (a: Profile, b: Profile) => {
  const x = value(a), y = value(b);
  if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
  return y - x;
};

const lastActive = (p: Profile) => (p.last_active_at ? Date.parse(p.last_active_at) : null);

/** A sorted copy. Ratings are not a sort: production has no reviews yet, so it would sort nothing. */
export function sortSitters(sitters: Profile[], sort: SortKey): Profile[] {
  const copy = [...sitters];
  if (sort === "price") {
    const rate = (p: Profile) => (p.rate_per_hour == null ? null : -p.rate_per_hour);
    return copy.sort(byDesc(rate));
  }
  if (sort === "active") return copy.sort(byDesc(lastActive));
  return copy.sort(byDesc((p) => p.experience_years ?? null));
}

/** How many of `sitters` offer each service — the number on each service pill. */
export function countByService(sitters: Profile[]): Record<ServiceType, number> {
  const counts = Object.fromEntries(Object.keys(SERVICE_LABELS).map((k) => [k, 0])) as Record<ServiceType, number>;
  for (const sitter of sitters) {
    for (const key of Object.keys(counts) as ServiceType[]) {
      if (sitter.services?.[key]) counts[key] += 1;
    }
  }
  return counts;
}

/**
 * The filters a link into /browse asks for. The landing page's service tiles send ?service=,
 * its hero search and city tiles ?city=; since the public directory went behind login
 * (2026-09-15) /browse is where they land.
 */
export function filtersFromSearch(search: string): { city: string | null; service: ServiceType | null } {
  const params = new URLSearchParams(search);

  const rawService = params.get("service");
  const service = rawService && Object.hasOwn(SERVICE_LABELS, rawService) ? (rawService as ServiceType) : null;

  const rawCity = params.get("city");
  const city = rawCity ? normaliseCity(rawCity) : null;

  return { city, service };
}

/**
 * Whether two stored or typed city names are the same city. Production holds "Kaunas" beside
 * "kaunas" and "Mažeikiai " with a trailing space, so an exact comparison splits one city.
 */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a ? normaliseCity(a) : null;
  return left !== null && left === (b ? normaliseCity(b) : null);
}
