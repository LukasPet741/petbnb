import { describe, it, expect } from "vitest";
import { filtersFromSearch, sameCity } from "@/lib/browse-filters";

/**
 * /browse is where the landing page's links land since the public directory went behind
 * login (2026-09-15): the hero search sends ?city=, a service tile ?service=. Without
 * reading them the visitor would log in and arrive at an unfiltered list.
 */

describe("filtersFromSearch", () => {
  it("reads a known service", () => {
    expect(filtersFromSearch("?service=grooming")).toEqual({ city: null, service: "grooming", from: null, to: null });
  });

  it("ignores a service that does not exist", () => {
    expect(filtersFromSearch("?service=surfing")).toEqual({ city: null, service: null, from: null, to: null });
  });

  it("reads a city in its display form, whatever case it was typed in", () => {
    expect(filtersFromSearch("?city=%20klaip%C4%97da%20")).toEqual({ city: "Klaipėda", service: null, from: null, to: null });
  });

  it("reads both at once, and nothing from an empty search", () => {
    expect(filtersFromSearch("?city=Kaunas&service=walking")).toEqual({ city: "Kaunas", service: "walking", from: null, to: null });
    expect(filtersFromSearch("")).toEqual({ city: null, service: null, from: null, to: null });
  });
});

describe("filtersFromSearch dates", () => {
  // A link can carry a stay, so a demo link or a landing search lands on the free sitters.
  it("reads a from/to pair of calendar days", () => {
    expect(filtersFromSearch("?from=2026-10-01&to=2026-10-05")).toMatchObject({ from: "2026-10-01", to: "2026-10-05" });
    expect(filtersFromSearch("?from=2026-10-01&to=2026-10-01")).toMatchObject({ from: "2026-10-01", to: "2026-10-01" });
  });

  it("drops both when they are reversed, malformed or half there", () => {
    for (const q of ["?from=2026-10-05&to=2026-10-01", "?from=nonsense&to=2026-10-01", "?from=2026-10-01", "?from=2026-10-01&to=2026-13-45x"]) {
      expect(filtersFromSearch(q)).toMatchObject({ from: null, to: null });
    }
  });
});

describe("sameCity", () => {
  it("matches production's differently-cased spellings of one city", () => {
    // Production holds both "Kaunas" and "kaunas", and "Mažeikiai " with a trailing space.
    expect(sameCity("kaunas", "Kaunas")).toBe(true);
    expect(sameCity("Mažeikiai ", "Mažeikiai")).toBe(true);
  });

  it("does not match different cities or a missing one", () => {
    expect(sameCity("Kaunas", "Vilnius")).toBe(false);
    expect(sameCity(null, "Kaunas")).toBe(false);
  });
});
