// Writes src/lib/listedPlaces.ts: pet businesses from OpenStreetMap for the places map's Listed tier.
// Then run scripts/place-logos-apply.mjs, which puts back the reviewed logos and drops dead websites.
//
//   node scripts/listed-places.mjs [overpass-endpoint]
//
// Facts only (name, what they do, address, coordinates, an https website), no logos or copy:
// these businesses have not agreed to anything, so they are listed until they claim their page
// (PetBnB ecosystem plan, "How businesses fit"). Data © OpenStreetMap contributors, ODbL.

import fs from "node:fs";

const ENDPOINT = process.argv[2] ?? "https://overpass-api.de/api/interpreter";
const OUT = "src/lib/listedPlaces.ts";

// south,west,north,east
const CITIES = {
  Vilnius: "54.56,25.02,54.83,25.48",
  Kaunas: "54.83,23.75,54.98,24.10",
  "Panevėžys": "55.69,24.27,55.77,24.42",
};

const CATEGORY = [
  ['["amenity"="veterinary"]', "vet"],
  ['["shop"="pet"]', "shop"],
  ['["shop"="pet_grooming"]', "grooming"],
  ['["amenity"="animal_boarding"]', "boarding"],
  ['["amenity"="animal_training"]', "training"],
];

// Already on /partners with their own consent; never listed twice.
const PARTNER_NAMES = ["dogiday", "dogpunk"];

// Left out: a generic label is not a business name (and would merge unrelated places), a bare
// personal name is a private person's data, and a livestock clinic is not a pet place.
// Compared after key(): lower case, no diacritics, no spaces or punctuation.
const SKIP = new Set([
  "veterinarijosklinika", "veterinarijospaslaugos", "gyvunuprekes", "gyvunuprekiuparduotuve",
  "zooprekes", "prekesgyvunams", "petstore", "petgrooming", "rzilinskienes",
]);
const SKIP_IF_CONTAINS = ["stambiujugyvunu"];

const query = `[out:json][timeout:25];(${Object.values(CITIES)
  .flatMap((box) => CATEGORY.map(([tag]) => `nwr${tag}(${box});`))
  .join("")});out center tags;`;

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "petbnb/1.0 (thesis prototype)" },
  body: "data=" + encodeURIComponent(query),
});
if (!res.ok) throw new Error(`Overpass answered ${res.status}; try another endpoint`);
const { elements } = await res.json();

const cityOf = (lat, lng) =>
  Object.entries(CITIES).find(([, box]) => {
    const [s, w, n, e] = box.split(",").map(Number);
    return lat >= s && lat <= n && lng >= w && lng <= e;
  })?.[0];

const categoryOf = (tags) =>
  tags.amenity === "veterinary" ? "vet"
  : tags.shop === "pet" ? "shop"
  : tags.shop === "pet_grooming" ? "grooming"
  : tags.amenity === "animal_boarding" ? "boarding"
  : "training";

const slugOf = (name) =>
  name.toLowerCase()
    .replace(/ą/g, "a").replace(/č/g, "c").replace(/[ęė]/g, "e").replace(/į/g, "i")
    .replace(/š/g, "s").replace(/[ųū]/g, "u").replace(/ž/g, "z")
    .normalize("NFKD").replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "place";

// "Vet1" and "VET-1", "Zoobazė" and "Zoobaze" are one business.
const key = (name) => slugOf(name).replace(/-/g, "");

const httpsUrl = (raw) => {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.trim().split(";")[0]);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

// One business per name: a chain's stores become one place with a pin per store.
const byName = new Map();
for (const e of elements) {
  const tags = e.tags ?? {};
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  const city = lat != null && lng != null ? cityOf(lat, lng) : undefined;
  if (!tags.name || !city) continue;
  const k = key(tags.name);
  if (PARTNER_NAMES.some((p) => k.includes(p)) || SKIP.has(k) || SKIP_IF_CONTAINS.some((s) => k.includes(s))) continue;

  const place = byName.get(k) ?? { names: new Map(), categories: new Set(), website: undefined, locations: [] };
  const name = tags.name.trim();
  place.names.set(name, (place.names.get(name) ?? 0) + 1);
  place.categories.add(categoryOf(tags));
  place.website ??= httpsUrl(tags.website ?? tags["contact:website"]);
  const street = tags["addr:street"];
  const address = street ? [street, tags["addr:housenumber"]].filter(Boolean).join(" ") : undefined;
  place.locations.push({ city, address, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, openingHours: tags.opening_hours?.trim() || undefined });
  byName.set(k, place);
}

const used = new Set(PARTNER_NAMES);
const places = [...byName.values()]
  // The spelling most of its stores use.
  .map((p) => ({ ...p, name: [...p.names].sort((a, b) => b[1] - a[1])[0][0] }))
  .sort((a, b) => a.name.localeCompare(b.name, "lt"))
  .map((p) => {
    let slug = slugOf(p.name);
    for (let n = 2; used.has(slug); n++) slug = `${slugOf(p.name)}-${n}`;
    used.add(slug);
    p.locations.sort((a, b) => a.city.localeCompare(b.city, "lt") || (a.address ?? "").localeCompare(b.address ?? "", "lt"));
    return {
      slug,
      name: p.name,
      tier: "listed",
      categories: [...p.categories].sort(),
      accepts: [],
      locations: p.locations.map((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined))),
      services: [],
      ...(p.website ? { website: p.website } : {}),
    };
  });

const today = new Date().toISOString().slice(0, 10);
const body = `// GENERATED by scripts/listed-places.mjs on ${today}. Do not edit by hand; run the script again.
//
// Pet businesses from OpenStreetMap (Vilnius, Kaunas, Panevėžys) for the places map's Listed tier:
// facts only, no logos or copy, because these businesses have not agreed to anything yet.
// Data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).

import type { Partner } from "@/lib/partners";

export const LISTED_PLACES: Partner[] = ${JSON.stringify(places, null, 2)};
`;
fs.writeFileSync(OUT, body);
console.log(`${places.length} places, ${places.reduce((n, p) => n + p.locations.length, 0)} pins → ${OUT}`);
