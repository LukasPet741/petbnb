import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fetchPlaces, rowToPlace, withoutPromoted, type PlaceRow } from "@/lib/placesDb";
import { LISTED_PLACES } from "@/lib/listedPlaces";
import { isBookable, isPromoted } from "@/lib/partners";

const partnerRow: PlaceRow = {
  slug: "dogpunk", name: "DogPunk", categories: ["training"], accepts: ["dog"], tier: "partner",
  description_lt: "Mokykla", description_en: "A school", prices_note_lt: null, prices_note_en: null,
  hours_lt: null, hours_en: null, website_url: "https://mokyksuni.lt/", logo_path: null, is_founding_partner: true,
  place_locations: [
    { city: "Panevėžys", area: null, address: "Ramygalos g. 94B", note_lt: null, note_en: null, lat: 55.7183, lng: 24.3646, approximate: false, sort_order: 2 },
    { city: "Vilnius", area: null, address: "Kalvarijų g. 143", note_lt: "Salėje", note_en: "Indoors", lat: 54.7185, lng: 25.2902, approximate: false, sort_order: 1 },
  ],
  place_services: [
    { name_lt: "Antra", name_en: "Second", price_from: null, price_to: null, unit_lt: null, unit_en: null, url: null, sort_order: 2 },
    { name_lt: "Pirma", name_en: "First", price_from: 20, price_to: 30, unit_lt: "už pamoką", unit_en: "per lesson", url: "https://mokyksuni.lt/a", sort_order: 1 },
  ],
};

const listedRow: PlaceRow = {
  slug: "kika", name: "Kika", categories: ["shop"], accepts: [], tier: "listed",
  description_lt: null, description_en: null, prices_note_lt: null, prices_note_en: null, hours_lt: null, hours_en: null,
  website_url: null, logo_path: null, is_founding_partner: false,
  place_locations: [{ city: "Kaunas", area: null, address: null, note_lt: null, note_en: null, lat: 54.9, lng: 23.9, approximate: false, sort_order: 1 }],
  place_services: [],
};

describe("rowToPlace", () => {
  it("turns a partner row into the place the map and dialog read, in sort order", () => {
    const place = rowToPlace(partnerRow);
    expect(place.tier).toBe("partner");
    expect(place.founding).toBe(true);
    expect(place.description).toEqual({ lt: "Mokykla", en: "A school" });
    expect(place.website).toBe("https://mokyksuni.lt/");
    expect(place.locations.map((l) => l.city)).toEqual(["Vilnius", "Panevėžys"]);
    expect(place.locations[0].note).toEqual({ lt: "Salėje", en: "Indoors" });
    expect(place.locations[1].note).toBeUndefined();
    expect(place.services.map((s) => s.name.en)).toEqual(["First", "Second"]);
    expect(place.services[0].price).toEqual({ from: 20, to: 30, unit: { lt: "už pamoką", en: "per lesson" } });
    expect(place.services[1].price).toBeUndefined();
  });

  it("keeps a listed row to facts: no description, no logo, no founding badge", () => {
    const place = rowToPlace(listedRow);
    expect(place.tier).toBe("listed");
    expect(place.description).toBeUndefined();
    expect(place.logo).toBeUndefined();
    expect(place.founding).toBe(false);
    expect(place.locations).toEqual([{ city: "Kaunas", lat: 54.9, lng: 23.9 }]);
  });

  it("reads promotion as a flag beside the tier, so a promoted Bookable place stays bookable", () => {
    const place = rowToPlace({ ...partnerRow, tier: "bookable", is_promoted: true });
    expect(place.tier).toBe("bookable");
    expect(isBookable(place)).toBe(true);
    expect(isPromoted(place)).toBe(true);
  });

  it("leaves a place unpromoted when the flag is false or absent", () => {
    expect(isPromoted(rowToPlace({ ...partnerRow, is_promoted: false }))).toBe(false);
    expect(isPromoted(rowToPlace(partnerRow))).toBe(false);
  });
});

/** A stand-in for the Supabase client: one select that answers with what the test says. */
const client = (answer: { data: unknown; error: unknown }) => ({
  from: () => ({ select: () => ({ eq: () => Promise.resolve(answer) }) }),
});

describe("fetchPlaces", () => {
  it("lists partners before listed places, then by name", async () => {
    const places = await fetchPlaces(client({ data: [listedRow, partnerRow], error: null }));
    expect(places?.map((p) => p.slug)).toEqual(["dogpunk", "kika"]);
  });

  it("lists promoted places first, whatever their tier", async () => {
    const promoted = { ...listedRow, slug: "zoo", name: "Zoo", tier: "bookable", is_promoted: true };
    const places = await fetchPlaces(client({ data: [listedRow, partnerRow, promoted], error: null }));
    expect(places?.map((p) => p.slug)).toEqual(["zoo", "dogpunk", "kika"]);
  });

  it("still reads the places before the promotion migration, without the flag", async () => {
    const asked: string[] = [];
    const premigration = {
      from: () => ({
        select: (columns: string) => ({
          eq: () => {
            asked.push(columns);
            return Promise.resolve(columns.includes("is_promoted") ? { data: null, error: { code: "42703" } } : { data: [listedRow, partnerRow], error: null });
          },
        }),
      }),
    };
    const places = await fetchPlaces(premigration);
    expect(places?.map((p) => p.slug)).toEqual(["dogpunk", "kika"]);
    expect(asked[1]).not.toContain("is_promoted");
    expect(asked[1]).toContain("is_founding_partner, place_locations(");
  });

  it("answers null when the table is not there yet, so the app keeps its built-in list", async () => {
    expect(await fetchPlaces(client({ data: null, error: { code: "PGRST205" } }))).toBeNull();
  });

  it("answers null for an empty table", async () => {
    expect(await fetchPlaces(client({ data: [], error: null }))).toBeNull();
  });
});

describe("the listed seed migration", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261026190000_places_listed.sql"), "utf8");

  it("seeds exactly the places the app falls back to", () => {
    const seeded = [...sql.matchAll(/^ {4}\('([a-z0-9-]+)', '.*'listed', 'public', 'published'/gm)].map((m) => m[1]);
    expect(seeded).toEqual(LISTED_PLACES.map((p) => p.slug));
  });

  it("seeds every address", () => {
    const addresses = LISTED_PLACES.reduce((n, p) => n + p.locations.length, 0);
    expect(sql).toContain(`(${addresses} addresses)`);
  });
});

describe("the promotion flag migration", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261103090000_place_promotion_flag.sql"), "utf8").replace(/--.*$/gm, "");

  it("adds is_promoted, off by default", () => {
    expect(sql).toMatch(/add column is_promoted boolean not null default false/);
  });

  it("moves every promoted-tier place onto the flag before the tier stops allowing it", () => {
    expect(sql.indexOf("set is_promoted = true")).toBeGreaterThan(-1);
    expect(sql.indexOf("set is_promoted = true")).toBeLessThan(sql.indexOf("add constraint places_tier_check"));
    expect(sql).toMatch(/check \(tier in \('listed', 'partner', 'bookable'\)\)/);
  });

  it("never lets an owner switch promotion on for themselves", () => {
    expect(sql).not.toMatch(/grant[^;]*is_promoted/i);
  });
});

describe("withoutPromoted", () => {
  it("drops is_promoted wherever it sits in a select", () => {
    expect(withoutPromoted("id, is_promoted, name")).toBe("id, name");
    expect(withoutPromoted("id, name, is_promoted")).toBe("id, name");
    expect(withoutPromoted("is_promoted, id")).toBe("id");
    expect(withoutPromoted("id, is_promoted, place_services(id, name)")).toBe("id, place_services(id, name)");
  });
});
