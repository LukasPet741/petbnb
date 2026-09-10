import { describe, it, expect } from "vitest";
import {
  REVIEW_DIMENSIONS,
  dimensionsFor,
  emptyDimensions,
  type ReviewDirection,
} from "@/lib/types";

/**
 * The database has a CHECK constraint — reviews_dimensions_match_direction — that
 * rejects a row carrying a dimension belonging to the other direction. These tests pin
 * the client's idea of which dimension belongs where against that constraint, because
 * disagreeing with it is a 23514 the user cannot act on.
 */

const OWNER_TO_SITTER: ReviewDirection = "owner_to_sitter";
const SITTER_TO_OWNER: ReviewDirection = "sitter_to_owner";

describe("REVIEW_DIMENSIONS", () => {
  it("asks an owner about the pet, the messages and whether the sitter showed up", () => {
    expect(REVIEW_DIMENSIONS[OWNER_TO_SITTER]).toEqual([
      "pet_wellbeing",
      "communication",
      "reliability",
    ]);
  });

  it("asks a sitter about the messages, the pet as described and the handover", () => {
    expect(REVIEW_DIMENSIONS[SITTER_TO_OWNER]).toEqual([
      "communication",
      "pet_as_described",
      "handover",
    ]);
  });

  it("asks both sides about communication, the one thing both actually experience", () => {
    expect(REVIEW_DIMENSIONS[OWNER_TO_SITTER]).toContain("communication");
    expect(REVIEW_DIMENSIONS[SITTER_TO_OWNER]).toContain("communication");
  });

  it("never offers a direction a dimension the CHECK constraint would reject", () => {
    // reviews_dimensions_match_direction: owner_to_sitter must leave pet_as_described
    // and handover null; sitter_to_owner must leave pet_wellbeing and reliability null.
    expect(REVIEW_DIMENSIONS[OWNER_TO_SITTER]).not.toContain("pet_as_described");
    expect(REVIEW_DIMENSIONS[OWNER_TO_SITTER]).not.toContain("handover");
    expect(REVIEW_DIMENSIONS[SITTER_TO_OWNER]).not.toContain("pet_wellbeing");
    expect(REVIEW_DIMENSIONS[SITTER_TO_OWNER]).not.toContain("reliability");
  });

  it("keeps both sides the same length, so neither form is the long one", () => {
    expect(REVIEW_DIMENSIONS[OWNER_TO_SITTER]).toHaveLength(3);
    expect(REVIEW_DIMENSIONS[SITTER_TO_OWNER]).toHaveLength(3);
  });
});

describe("dimensionsFor", () => {
  it.each([
    [OWNER_TO_SITTER, "pet_wellbeing"],
    [SITTER_TO_OWNER, "handover"],
  ])("returns the set belonging to %s", (direction, expected) => {
    expect(dimensionsFor(direction)).toContain(expected);
  });

  it("returns the same array the map holds, not a copy that can drift", () => {
    expect(dimensionsFor(OWNER_TO_SITTER)).toBe(REVIEW_DIMENSIONS[OWNER_TO_SITTER]);
  });
});

describe("emptyDimensions", () => {
  /**
   * Every dimension column has to be sent explicitly, including the ones this direction
   * does not ask about: an UPDATE that omits them would leave a stale value from a
   * previous edit, and the CHECK would then reject the row.
   */
  it("nulls every one of the five columns for an owner reviewing a sitter", () => {
    expect(emptyDimensions(OWNER_TO_SITTER)).toEqual({
      communication: null,
      pet_wellbeing: null,
      reliability: null,
      pet_as_described: null,
      handover: null,
    });
  });

  it("nulls every one of the five columns for a sitter reviewing an owner", () => {
    expect(emptyDimensions(SITTER_TO_OWNER)).toEqual({
      communication: null,
      pet_wellbeing: null,
      reliability: null,
      pet_as_described: null,
      handover: null,
    });
  });

  it("names every column the table has, so no dimension can be silently forgotten", () => {
    const keys = Object.keys(emptyDimensions(OWNER_TO_SITTER)).sort();
    expect(keys).toEqual([
      "communication",
      "handover",
      "pet_as_described",
      "pet_wellbeing",
      "reliability",
    ]);
  });
});
