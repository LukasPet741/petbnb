import { describe, it, expect } from "vitest";
import { offeredServices, resolveService } from "@/lib/services";
import type { ServiceType } from "@/lib/types";

/**
 * Which services a sitter actually offers, and which one the form should hold.
 *
 * The booking form used to render all four services from SERVICE_LABELS and default
 * to "walking" regardless of the sitter. In production that is wrong for every single
 * sitter: all 25 offer between one and three services, not one offers all four, and 8
 * offer exactly one. So a booking for a service the sitter does not provide was two
 * taps away, and the default was silently wrong for anyone who does not walk dogs.
 *
 * Both functions are pure so the rules can be tested without React, a router or a
 * Supabase mock -- the same split that keeps ReviewForm's tests free of them.
 */

const all: Record<ServiceType, boolean> = {
  walking: true,
  boarding: true,
  daycare: true,
  grooming: true,
};

describe("offeredServices", () => {
  it("returns every service the sitter marked true", () => {
    expect(offeredServices(all)).toEqual(["walking", "boarding", "daycare", "grooming"]);
  });

  it("returns them in SERVICE_KEYS order, not the object's key order", () => {
    // The map comes back from Postgres as JSON, whose key order is whatever was
    // written. Rendering in that order would shuffle the options between sitters.
    expect(offeredServices({ grooming: true, walking: true })).toEqual(["walking", "grooming"]);
  });

  it("returns only the subset that is true", () => {
    expect(offeredServices({ ...all, boarding: false, grooming: false })).toEqual([
      "walking",
      "daycare",
    ]);
  });

  it("returns nothing for a sitter who offers nothing", () => {
    // Reachable: the profile form lets a sitter save with no service ticked. No
    // production sitter is in this state today, but the form must not offer four
    // options to someone who provides none.
    expect(offeredServices({})).toEqual([]);
    expect(offeredServices({ walking: false })).toEqual([]);
  });

  it("survives a missing or null services map", () => {
    expect(offeredServices(null)).toEqual([]);
    expect(offeredServices(undefined)).toEqual([]);
  });

  it("ignores keys that are not services", () => {
    // Nothing stops a row carrying an extra key; it must never become an option,
    // because `service` has a CHECK constraint and the insert would 23514.
    expect(offeredServices({ walking: true, sledding: true } as Record<string, boolean>)).toEqual([
      "walking",
    ]);
  });

  it("fails closed on values that are not booleans", () => {
    // The column is a JSON object of booleans. Anything else is malformed, and
    // truthiness would count the string "false" as an offered service.
    expect(offeredServices({ walking: "true" } as unknown as Record<ServiceType, boolean>)).toEqual([]);
    expect(offeredServices({ walking: 1 } as unknown as Record<ServiceType, boolean>)).toEqual([]);
  });
});

describe("resolveService", () => {
  it("keeps a choice the sitter still offers", () => {
    expect(resolveService(["walking", "daycare"], "daycare")).toBe("daycare");
  });

  it("preselects the only service when the sitter offers exactly one", () => {
    // 8 of 25 production sitters. Making them tap the single available option is
    // pointless ceremony.
    expect(resolveService(["boarding"], "")).toBe("boarding");
  });

  it("chooses nothing when several are offered", () => {
    // Deliberately empty rather than defaulting: a silent default is exactly how the
    // old form sent "walking" to sitters who do not walk dogs.
    expect(resolveService(["walking", "boarding"], "")).toBe("");
  });

  it("clears a choice the new sitter does not offer", () => {
    // Changing sitter must not carry a stale selection into the insert.
    expect(resolveService(["boarding", "grooming"], "walking")).toBe("");
  });

  it("replaces an invalid choice with the only option when there is one", () => {
    expect(resolveService(["grooming"], "walking")).toBe("grooming");
  });

  it("returns nothing when the sitter offers nothing", () => {
    expect(resolveService([], "walking")).toBe("");
    expect(resolveService([], "")).toBe("");
  });
});
