import { describe, it, expect } from "vitest";
import { filtersFromSearch, sameCity } from "@/lib/browse-filters";

/**
 * /browse is where the landing page's links land since the public directory went behind
 * login (2026-09-15): the hero search sends ?city=, a service tile ?service=. Without
 * reading them the visitor would log in and arrive at an unfiltered list.
 */

describe("filtersFromSearch", () => {
  it("reads a known service", () => {
    expect(filtersFromSearch("?service=grooming")).toEqual({ city: null, service: "grooming" });
  });

  it("ignores a service that does not exist", () => {
    expect(filtersFromSearch("?service=surfing")).toEqual({ city: null, service: null });
  });

  it("reads a city in its display form, whatever case it was typed in", () => {
    expect(filtersFromSearch("?city=%20klaip%C4%97da%20")).toEqual({ city: "Klaipėda", service: null });
  });

  it("reads both at once, and nothing from an empty search", () => {
    expect(filtersFromSearch("?city=Kaunas&service=walking")).toEqual({ city: "Kaunas", service: "walking" });
    expect(filtersFromSearch("")).toEqual({ city: null, service: null });
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
