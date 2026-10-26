import { describe, it, expect } from "vitest";
import { PARTNERS, formatPartnerPrice, partnerPlace, partnerWebsite, type Partner } from "@/lib/partners";

describe("partners data", () => {
  it("gives every partner a unique slug", () => {
    const slugs = PARTNERS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("describes every partner and service in both languages", () => {
    for (const p of PARTNERS) {
      expect(p.description.lt && p.description.en, p.slug).toBeTruthy();
      for (const s of p.services) expect(s.name.lt && s.name.en, p.slug).toBeTruthy();
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
    slug: "x", name: "X", categories: [], locations: [{ city: "Kaunas" }],
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

describe("partnerPlace", () => {
  const base: Partner = {
    slug: "x", name: "X", categories: [], locations: [],
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
