import { SERVICE_LABELS, type ServiceType } from "@/lib/types";
import { normaliseCity } from "@/lib/utils";

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
