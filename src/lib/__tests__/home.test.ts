import { describe, it, expect } from "vitest";
import { excerpt, topCities, pickVoices } from "@/lib/home";
import type { Profile } from "@/lib/types";

let seq = 0;
function sitter(over: Partial<Profile> = {}): Profile {
  seq += 1;
  return {
    id: `s-${seq}`,
    full_name: `Sitter ${seq}`,
    phone: "+370 600 00000",
    city: "Vilnius",
    is_sitter: true,
    rate_per_hour: 15,
    experience_years: 3,
    services: { walking: true, boarding: false, daycare: false, grooming: false },
    about_me: "I have looked after dogs for years and love long walks.",
    avatar_url: "https://x/a.jpg",
    last_active_at: "2026-09-01T10:00:00Z",
    ...over,
  } as Profile;
}

// ---------------------------------------------------------------------------
// excerpt - pure
// ---------------------------------------------------------------------------

describe("excerpt", () => {
  it("returns a short string unchanged", () => {
    expect(excerpt("Short bio.")).toBe("Short bio.");
  });

  it("trims surrounding whitespace", () => {
    expect(excerpt("   padded   ")).toBe("padded");
  });

  it("collapses newlines and tabs into single spaces", () => {
    expect(excerpt("a\n\nb\tc")).toBe("a b c");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(excerpt("   \n\t  ")).toBe("");
  });

  it("leaves a string of exactly the limit untouched, with no ellipsis", () => {
    const exact = "x".repeat(220);
    expect(excerpt(exact)).toBe(exact);
    expect(excerpt(exact)).not.toContain("…");
  });

  it("cuts at the last word boundary once over the limit", () => {
    // The space at index 210 sits well inside the window, so the partial word
    // after it is dropped rather than severed mid-way.
    const out = excerpt(`${"x".repeat(210)} ${"y".repeat(50)}`);
    expect(out).toBe(`${"x".repeat(210)}…`);
  });

  it("hard-cuts a long unbroken string that has no spaces at all", () => {
    expect(excerpt("y".repeat(300))).toBe(`${"y".repeat(220)}…`);
  });

  // Regression. This used to collapse to the single-character quote "a…",
  // because the cut retreated to the last space however early it fell, and
  // that one-letter string was then rendered as a featured testimonial.
  it("keeps the hard cut when the only space would discard most of the window", () => {
    const out = excerpt(`a ${"z".repeat(400)}`);
    expect(out).toHaveLength(221);
    expect(out.startsWith("a z")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
  });

  it("hard-cuts when there is no space left after trimming", () => {
    expect(excerpt(` ${"z".repeat(400)}`)).toBe(`${"z".repeat(220)}…`);
  });

  it("counts a Lithuanian diacritic as a single character", () => {
    expect(excerpt("ą".repeat(221))).toHaveLength(221);
  });

  it("returns just an ellipsis when the limit is zero", () => {
    expect(excerpt("anything at all", 0)).toBe("…");
  });

  it("retreats to the word boundary for a negative limit, as slice semantics imply", () => {
    expect(excerpt("anything at all", -5)).toBe("anything…");
  });
});

// ---------------------------------------------------------------------------
// topCities
// ---------------------------------------------------------------------------

describe("topCities", () => {
  it("returns nothing for an empty list", () => {
    expect(topCities([])).toEqual([]);
  });

  it("groups sitters by city and counts them", () => {
    const out = topCities([
      sitter({ city: "Kaunas" }),
      sitter({ city: "Kaunas" }),
      sitter({ city: "Vilnius" }),
    ]);
    expect(out.map((c) => [c.name, c.sitters.length])).toEqual([
      ["Kaunas", 2],
      ["Vilnius", 1],
    ]);
  });

  // Production really does hold both spellings; grouping on the raw string
  // printed Kaunas twice in the grid.
  it("folds case variants into one city", () => {
    const out = topCities([
      sitter({ city: "Kaunas" }),
      sitter({ city: "kaunas" }),
      sitter({ city: "KAUNAS" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sitters).toHaveLength(3);
  });

  it("displays the spelling that occurs most often", () => {
    const out = topCities([
      sitter({ city: "kaunas" }),
      sitter({ city: "Kaunas" }),
      sitter({ city: "Kaunas" }),
    ]);
    expect(out[0].name).toBe("Kaunas");
  });

  it("trims trailing whitespace, which real rows carry", () => {
    const out = topCities([sitter({ city: "Mažeikiai " })]);
    expect(out[0].name).toBe("Mažeikiai");
  });

  it("collapses inner whitespace runs", () => {
    expect(topCities([sitter({ city: "Naujoji  Akmenė" })])[0].name).toBe("Naujoji Akmenė");
  });

  it.each([["null", null], ["empty", ""], ["whitespace", "   "]])(
    "skips a sitter whose city is %s",
    (_label, city) => {
      expect(topCities([sitter({ city: city as string })])).toEqual([]);
    }
  );

  it("ignores profiles that are not sitters", () => {
    expect(topCities([sitter({ is_sitter: false, city: "Vilnius" })])).toEqual([]);
  });

  it("orders by sitter count, descending", () => {
    const out = topCities([
      sitter({ city: "Vilnius" }),
      sitter({ city: "Kaunas" }),
      sitter({ city: "Kaunas" }),
    ]);
    expect(out[0].name).toBe("Kaunas");
  });

  it("breaks a count tie alphabetically, so the grid order never wobbles", () => {
    const out = topCities([sitter({ city: "Vilnius" }), sitter({ city: "Kaunas" })]);
    expect(out.map((c) => c.name)).toEqual(["Kaunas", "Vilnius"]);
  });

  it("honours the limit", () => {
    const cities = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus"];
    expect(topCities(cities.map((city) => sitter({ city })), 5)).toHaveLength(5);
  });

  it("exposes a folded key that matches regardless of the source spelling", () => {
    expect(topCities([sitter({ city: "KAUNAS" })])[0].key).toBe("kaunas");
  });
});

// ---------------------------------------------------------------------------
// pickVoices
// ---------------------------------------------------------------------------

describe("pickVoices", () => {
  it.each([["null", null], ["empty", ""], ["whitespace only", "  \n "]])(
    "excludes a sitter whose bio is %s",
    (_label, about_me) => {
      expect(pickVoices([sitter({ about_me: about_me as string })])).toEqual([]);
    }
  );

  it("excludes profiles that are not sitters", () => {
    expect(pickVoices([sitter({ is_sitter: false })])).toEqual([]);
  });

  it("orders by experience, most first", () => {
    const out = pickVoices([
      sitter({ full_name: "Junior", experience_years: 1 }),
      sitter({ full_name: "Senior", experience_years: 9 }),
    ]);
    expect(out.map((s) => s.full_name)).toEqual(["Senior", "Junior"]);
  });

  it("sorts a null experience last rather than first", () => {
    const out = pickVoices([
      sitter({ full_name: "Unknown", experience_years: null }),
      sitter({ full_name: "Known", experience_years: 0 }),
    ]);
    expect(out.map((s) => s.full_name)).toEqual(["Known", "Unknown"]);
  });

  it("breaks an experience tie by name, so the wall does not reshuffle per render", () => {
    const out = pickVoices([
      sitter({ full_name: "Rūta", experience_years: 4 }),
      sitter({ full_name: "Andrius", experience_years: 4 }),
    ]);
    expect(out.map((s) => s.full_name)).toEqual(["Andrius", "Rūta"]);
  });

  it("honours the limit", () => {
    expect(pickVoices(Array.from({ length: 10 }, () => sitter()), 6)).toHaveLength(6);
  });

  it("tolerates a null name while sorting", () => {
    const out = pickVoices([
      sitter({ full_name: null as unknown as string, experience_years: 2 }),
      sitter({ full_name: "Named", experience_years: 2 }),
    ]);
    expect(out).toHaveLength(2);
  });
});
