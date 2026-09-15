import { describe, it, expect } from "vitest";
import { sortSitters, countByService } from "@/lib/browse-filters";
import type { Profile } from "@/lib/types";

/**
 * /browse variant A (2026-09-15): a sort choice and service pills that say how many sitters
 * each would show, so "Kirpimas · 2" warns before the click instead of after.
 */

// Loose on purpose: production rows carry nulls and partial service maps the Profile type forbids.
const s = (over: Record<string, unknown>) => ({ id: "x", services: {}, ...over }) as unknown as Profile;
const ids = (list: Profile[]) => list.map((p) => p.id);

describe("sortSitters", () => {
  const list = [
    s({ id: "cheap-new", services: { walking: true }, prices: { walking: { amount: 12, days: 1 } }, experience_years: 1, last_active_at: "2026-09-01T00:00:00Z" }),
    s({ id: "pricey-veteran", services: { boarding: true }, prices: { boarding: { amount: 90, days: 3 } }, experience_years: 12, last_active_at: "2026-09-14T00:00:00Z" }),
    s({ id: "no-rate", services: { walking: true }, prices: {}, experience_years: null, last_active_at: null }),
  ];

  it("puts the most experienced first by default, unknowns last", () => {
    expect(ids(sortSitters(list, "experience"))).toEqual(["pricey-veteran", "cheap-new", "no-rate"]);
  });

  it("puts the cheapest daily rate first, unknown prices last", () => {
    expect(ids(sortSitters(list, "price"))).toEqual(["cheap-new", "pricey-veteran", "no-rate"]);
  });

  it("compares the chosen service's price when a service is chosen", () => {
    const both = [
      s({ id: "walks-cheap-boards-dear", services: { walking: true, boarding: true }, prices: { walking: { amount: 8, days: 1 }, boarding: { amount: 120, days: 3 } } }),
      s({ id: "boards-cheap", services: { boarding: true }, prices: { boarding: { amount: 60, days: 3 } } }),
    ];
    expect(ids(sortSitters(both, "price"))).toEqual(["walks-cheap-boards-dear", "boards-cheap"]);
    expect(ids(sortSitters(both, "price", "boarding"))).toEqual(["boards-cheap", "walks-cheap-boards-dear"]);
  });

  it("puts the most recently active first, never-active last", () => {
    expect(ids(sortSitters(list, "active"))).toEqual(["pricey-veteran", "cheap-new", "no-rate"]);
  });

  it("does not reorder the list it was given", () => {
    sortSitters(list, "price");
    expect(ids(list)).toEqual(["cheap-new", "pricey-veteran", "no-rate"]);
  });
});

describe("countByService", () => {
  it("counts the sitters offering each service", () => {
    const counts = countByService([
      s({ services: { walking: true, grooming: true } }),
      s({ services: { walking: true, grooming: false } }),
      s({ services: null }),
    ]);
    expect(counts).toEqual({ walking: 2, boarding: 0, daycare: 0, grooming: 1 });
  });
});
