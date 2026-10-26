import { describe, it, expect } from "vitest";
import { PRIVACY_FLOOR, areaCircles, countByCity } from "@/lib/areaCounts";

const rows = (city: string | null, n: number) => Array.from({ length: n }, () => ({ city }));

describe("countByCity", () => {
  it("counts each city and hides one under the privacy floor", () => {
    const counts = countByCity([...rows("Vilnius", 6), ...rows("Panevėžys", 4), ...rows("Kaunas", 5)]);
    expect(counts).toEqual([
      { city: "Vilnius", count: 6 },
      { city: "Kaunas", count: 5 },
    ]);
    expect(PRIVACY_FLOOR).toBe(5);
  });

  it("ignores rows with no city and trims stray spaces", () => {
    expect(countByCity([...rows(null, 9), ...rows(" Vilnius ", 5)])).toEqual([{ city: "Vilnius", count: 5 }]);
  });

  it("re-applies the floor to counts that come from the database", () => {
    expect(countByCity([], [{ city: "Vilnius", sitters: 7 }, { city: "Alytus", sitters: 2 }])).toEqual([{ city: "Vilnius", count: 7 }]);
  });
});

describe("areaCircles", () => {
  it("puts each known city's count on the city's centre", () => {
    const [vilnius, kaunas] = areaCircles([{ city: "Vilnius", count: 12 }, { city: "Kaunas", count: 5 }]);
    expect(vilnius).toMatchObject({ city: "Vilnius", count: 12 });
    expect(vilnius.lat).toBeCloseTo(54.687, 2);
    expect(kaunas.lng).toBeCloseTo(23.904, 2);
  });

  it("leaves out a city it has no centre for, rather than guess", () => {
    expect(areaCircles([{ city: "Atlantis", count: 9 }])).toEqual([]);
  });
});
