import type { PetType } from "@/lib/types";
import type { Localized, Partner, PartnerCategory, PartnerLocation, PartnerService } from "@/lib/partners";

/**
 * The places map, read from the places tables (migrations 20261026180000_places,
 * 20261026190000_places_listed). Until those are live, or whenever the read fails, the app
 * keeps the list built into partners.ts + listedPlaces.ts, which holds the same places.
 */

export interface PlaceLocationRow {
  city: string;
  area: string | null;
  address: string | null;
  note_lt: string | null;
  note_en: string | null;
  lat: number | null;
  lng: number | null;
  approximate: boolean;
  sort_order: number;
}

export interface PlaceServiceRow {
  name_lt: string;
  name_en: string;
  price_from: number | null;
  price_to: number | null;
  unit_lt: string | null;
  unit_en: string | null;
  url: string | null;
  sort_order: number;
}

export interface PlaceRow {
  id?: string;
  slug: string;
  name: string;
  categories: string[];
  accepts: string[];
  tier: string;
  description_lt: string | null;
  description_en: string | null;
  prices_note_lt: string | null;
  prices_note_en: string | null;
  hours_lt: string | null;
  hours_en: string | null;
  website_url: string | null;
  logo_path: string | null;
  is_founding_partner: boolean;
  place_locations: PlaceLocationRow[];
  place_services: PlaceServiceRow[];
}

const COLUMNS =
  "id, slug, name, categories, accepts, tier, description_lt, description_en, prices_note_lt, prices_note_en, " +
  "hours_lt, hours_en, website_url, logo_path, is_founding_partner, " +
  "place_locations(city, area, address, note_lt, note_en, lat, lng, approximate, sort_order), " +
  "place_services(name_lt, name_en, price_from, price_to, unit_lt, unit_en, url, sort_order)";

/**
 * The one query this module makes. The places tables are not in database.types.ts until it is
 * regenerated after the migration, so the client is taken by this shape instead of its type.
 */
export interface PlacesClient {
  from(table: "places"): {
    select(columns: string): { eq(column: "status", value: "published"): PromiseLike<{ data: unknown; error: unknown }> };
  };
}

/** Both languages, or nothing: a half-translated field is left out rather than shown empty. */
const localized = (lt: string | null, en: string | null): Localized | undefined => (lt && en ? { lt, en } : undefined);

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;

export function rowToPlace(row: PlaceRow): Partner {
  const locations = [...row.place_locations].sort(bySortOrder).map((l): PartnerLocation => {
    const loc: PartnerLocation = { city: l.city };
    if (l.area) loc.area = l.area;
    if (l.address) loc.address = l.address;
    const note = localized(l.note_lt, l.note_en);
    if (note) loc.note = note;
    if (l.lat != null && l.lng != null) {
      loc.lat = l.lat;
      loc.lng = l.lng;
    }
    if (l.approximate) loc.approximate = true;
    return loc;
  });

  const services = [...row.place_services].sort(bySortOrder).map((s): PartnerService => {
    const service: PartnerService = { name: { lt: s.name_lt, en: s.name_en } };
    const unit = localized(s.unit_lt, s.unit_en);
    if (s.price_from != null && unit) {
      service.price = s.price_to != null ? { from: Number(s.price_from), to: Number(s.price_to), unit } : { from: Number(s.price_from), unit };
    }
    if (s.url) service.url = s.url;
    return service;
  });

  return {
    slug: row.slug,
    name: row.name,
    tier: row.tier === "listed" || row.tier === "bookable" || row.tier === "promoted" ? row.tier : "partner",
    id: row.id,
    categories: row.categories as PartnerCategory[],
    accepts: row.accepts as PetType[],
    locations,
    services,
    description: localized(row.description_lt, row.description_en),
    pricesNote: localized(row.prices_note_lt, row.prices_note_en),
    hours: localized(row.hours_lt, row.hours_en),
    website: row.website_url ?? undefined,
    logo: row.logo_path ?? undefined,
    founding: row.is_founding_partner,
  };
}

const rank = (p: Partner) => (p.tier === "promoted" ? 0 : p.tier === "listed" ? 2 : 1);

/** Published places, promoted and partners first and then by name; null when there is nothing to read. */
export async function fetchPlaces(client: PlacesClient): Promise<Partner[] | null> {
  try {
    const { data, error } = await client.from("places").select(COLUMNS).eq("status", "published");
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return (data as PlaceRow[])
      .map(rowToPlace)
      // Promoted first (it is what was paid for, and it is labelled), then partners, then listed.
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "lt"));
  } catch {
    return null;
  }
}
