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
    s({ id: "cheap-new", rate_per_hour: 12, experience_years: 1, last_active_at: "2026-09-01T00:00:00Z" }),
    s({ id: "pricey-veteran", rate_per_hour: 30, experience_years: 12, last_active_at: "2026-09-14T00:00:00Z" }),
    s({ id: "no-rate", rate_per_hour: null, experience_years: null, last_active_at: null }),
  ];

  it("puts the most experienced first by default, unknowns last", () => {
    expect(ids(sortSitters(list, "experience"))).toEqual(["pricey-veteran", "cheap-new", "no-rate"]);
  });

  it("puts the cheapest first, unknown rates last", () => {
    expect(ids(sortSitters(list, "price"))).toEqual(["cheap-new", "pricey-veteran", "no-rate"]);
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
