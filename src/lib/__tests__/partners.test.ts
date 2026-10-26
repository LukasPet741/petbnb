import { describe, it, expect } from "vitest";
import { ALL_PLACES, PARTNERS, distinctLocations, formatPartnerPrice, joinPetNames, mapPlaces, offeredCategories, partnerPlace, partnerWebsite, partnersDoing, partnersFor, type Partner } from "@/lib/partners";

describe("partners data", () => {
  it("gives every partner a unique slug", () => {
    const slugs = PARTNERS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("describes every partner and service in both languages", () => {
    for (const p of PARTNERS) {
      expect(p.description?.lt && p.description?.en, p.slug).toBeTruthy();
      for (const s of p.services) expect(s.name.lt && s.name.en, p.slug).toBeTruthy();
    }
  });

  it("says which animals every partner takes", () => {
    for (const p of PARTNERS) expect(p.accepts.length, p.slug).toBeGreaterThan(0);
  });

  it("places every geocoded location inside Lithuania", () => {
    for (const place of mapPlaces(PARTNERS)) {
      expect(place.lat, place.slug).toBeGreaterThan(53.8);
      expect(place.lat, place.slug).toBeLessThan(56.5);
      expect(place.lng, place.slug).toBeGreaterThan(20.9);
      expect(place.lng, place.slug).toBeLessThan(26.9);
    }
  });

  it("links only to https sites and to logos under /partners/", () => {
    for (const p of PARTNERS) {
      if (p.website) expect(p.website, p.slug).toMatch(/^https:\/\//);
      if (p.logo) expect(p.logo, p.slug).toMatch(/^\/partners\//);
      for (const s of p.services) if (s.url) expect(s.url, p.slug).toMatch(/^https:\/\//);
    }
  });
});

describe("partnerWebsite", () => {
  const base: Partner = {
    slug: "x", name: "X", categories: [], accepts: ["dog"], locations: [{ city: "Kaunas" }],
    description: { lt: "a", en: "a" }, services: [],
  };

  it("tags the link so the partner can see PetBnB's visits", () => {
    const url = new URL(partnerWebsite({ ...base, website: "https://example.lt/kainos?a=1" })!);
    expect(url.searchParams.get("utm_source")).toBe("petbnb");
    expect(url.searchParams.get("a")).toBe("1");
  });

  it("is null without a website", () => {
    expect(partnerWebsite(base)).toBeNull();
  });
});

describe("formatPartnerPrice", () => {
  const unit = { lt: "už parą", en: "per night" };

  it("shows a range when there is an upper bound", () => {
    expect(formatPartnerPrice({ from: 25, to: 40, unit }, "lt", "nuo")).toBe("€25–40 už parą");
  });

  it("says 'from' when there is none", () => {
    expect(formatPartnerPrice({ from: 25, unit }, "en", "from")).toBe("from €25 per night");
  });
});

describe("distinctLocations", () => {
  it("lists two stores with no street address in one city once", () => {
    const lines = distinctLocations([
      { city: "Kaunas", lat: 54.9, lng: 23.9 },
      { city: "Kaunas", lat: 54.8, lng: 23.8 },
      { city: "Kaunas", address: "Jonavos g. 60" },
    ]);
    expect(lines.map((l) => l.address ?? l.city)).toEqual(["Kaunas", "Jonavos g. 60"]);
  });
});

describe("partnerPlace", () => {
  const base: Partner = {
    slug: "x", name: "X", categories: [], accepts: ["dog"], locations: [],
    description: { lt: "a", en: "a" }, services: [],
  };

  it("names the area when there is one place", () => {
    expect(partnerPlace({ ...base, locations: [{ city: "Vilnius", area: "Antakalnis" }] })).toBe("Vilnius, Antakalnis");
  });

  it("lists each city once when there are several places", () => {
    const locations = [{ city: "Vilnius" }, { city: "Panevėžys" }, { city: "Vilnius" }];
    expect(partnerPlace({ ...base, locations })).toBe("Vilnius · Panevėžys");
  });
});

describe("partnersFor", () => {
  const base: Omit<Partner, "slug" | "accepts"> = {
    name: "X", categories: [], locations: [], description: { lt: "a", en: "a" }, services: [],
  };
  const dogs: Partner = { ...base, slug: "dogs", accepts: ["dog"] };
  const both: Partner = { ...base, slug: "both", accepts: ["dog", "cat"] };

  it("keeps only partners that take one of the pets", () => {
    expect(partnersFor(["cat"], [dogs, both]).map((p) => p.slug)).toEqual(["both"]);
  });

  it("keeps every partner when no pet is given", () => {
    expect(partnersFor([], [dogs, both])).toHaveLength(2);
  });

  it("keeps a listed place whose pets are not known yet, whatever the pet", () => {
    const vet: Partner = { ...base, slug: "vet", accepts: [], tier: "listed" };
    expect(partnersFor(["reptile"], [dogs, vet]).map((p) => p.slug)).toEqual(["vet"]);
  });
});

describe("mapPlaces", () => {
  it("gives one point per geocoded location and skips the rest", () => {
    const partner: Partner = {
      slug: "two", name: "Two", categories: [], accepts: ["dog"], description: { lt: "a", en: "a" }, services: [],
      locations: [{ city: "Vilnius", lat: 54.7, lng: 25.3 }, { city: "Kaunas" }, { city: "Panevėžys", lat: 55.7, lng: 24.4, approximate: true }],
    };
    expect(mapPlaces([partner])).toEqual([
      { slug: "two", name: "Two", lat: 54.7, lng: 25.3, approximate: false, listed: false },
      { slug: "two", name: "Two", lat: 55.7, lng: 24.4, approximate: true, listed: false },
    ]);
  });

  it("marks the pins of a listed place", () => {
    const listed: Partner = {
      slug: "vet", name: "Vet", tier: "listed", categories: ["vet"], accepts: [], services: [],
      locations: [{ city: "Kaunas", lat: 54.9, lng: 23.9 }],
    };
    expect(mapPlaces([listed])[0].listed).toBe(true);
  });
});

describe("partnersDoing", () => {
  const base: Omit<Partner, "slug" | "categories"> = {
    name: "X", accepts: ["dog"], locations: [], description: { lt: "a", en: "a" }, services: [],
  };
  const hotel: Partner = { ...base, slug: "hotel", categories: ["boarding", "daycare"] };
  const school: Partner = { ...base, slug: "school", categories: ["training"] };

  it("keeps only partners that do this", () => {
    expect(partnersDoing("training", [hotel, school]).map((p) => p.slug)).toEqual(["school"]);
  });

  it("keeps every partner when no category is chosen", () => {
    expect(partnersDoing(null, [hotel, school])).toHaveLength(2);
  });

  it("lists what the partners do, each once, in a fixed order", () => {
    expect(offeredCategories([school, hotel])).toEqual(["boarding", "daycare", "training"]);
  });
});

describe("joinPetNames", () => {
  it("joins with 'or' in each language", () => {
    expect(joinPetNames(["Reksas", "Murka"], "en")).toBe("Reksas or Murka");
    expect(joinPetNames(["Reksas", "Murka"], "lt")).toBe("Reksas ar Murka");
    expect(joinPetNames(["Reksas"], "en")).toBe("Reksas");
  });
});

describe("listed places (OpenStreetMap)", () => {
  const listed = ALL_PLACES.filter((p) => p.tier === "listed");

  it("fills the map beyond the partners", () => {
    expect(listed.length).toBeGreaterThan(20);
    expect(offeredCategories(ALL_PLACES)).toEqual(expect.arrayContaining(["vet", "shop"]));
  });

  it("gives every place, partner or listed, its own slug", () => {
    const slugs = ALL_PLACES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("lists facts only: no logo, no copy, no claimed pets, no founding badge", () => {
    for (const p of listed) {
      expect(p.logo, p.slug).toBeUndefined();
      expect(p.description, p.slug).toBeUndefined();
      expect(p.founding, p.slug).toBeFalsy();
      expect(p.accepts, p.slug).toEqual([]);
      if (p.website) expect(p.website, p.slug).toMatch(/^https:\/\//);
    }
  });

  it("puts every listed pin inside Lithuania", () => {
    for (const place of mapPlaces(listed)) {
      expect(place.lat, place.slug).toBeGreaterThan(53.8);
      expect(place.lat, place.slug).toBeLessThan(56.5);
      expect(place.lng, place.slug).toBeGreaterThan(20.9);
      expect(place.lng, place.slug).toBeLessThan(26.9);
    }
  });

  it("never lists a partner a second time", () => {
    expect(listed.map((p) => p.slug)).not.toEqual(expect.arrayContaining(["dogiday"]));
    expect(listed.some((p) => /dog ?punk|dogiday/i.test(p.name))).toBe(false);
  });
});
