import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SitterRibbon from "@/components/home/SitterRibbon";
import type { Profile } from "@/lib/types";

/**
 * The strip of sitters under the hero (Night Forest, 2026-10-24). Rendered without a
 * LanguageProvider, so `t` returns the key it was asked for.
 */

let seq = 0;
function sitter(over: Partial<Profile> = {}): Profile {
  seq += 1;
  return {
    id: `s-${seq}`,
    full_name: `Sitter${seq} Surname`,
    city: "Kaunas",
    is_sitter: true,
    experience_years: 3,
    services: { walking: true, boarding: false, daycare: false, grooming: false },
    prices: { walking: { days: 1, amount: 10 } },
    about_me: "Bio.",
    avatar_url: "https://x/a.jpg",
    ...over,
  } as Profile;
}

describe("states", () => {
  it("draws pulsing placeholders while the sitters load, and no links yet", () => {
    const { container } = render(<SitterRibbon sitters={[]} status="loading" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(container.querySelectorAll('a[href^="/browse/"]')).toHaveLength(0);
  });

  it("renders nothing when the query failed, so the hero ends on its own", () => {
    const { container } = render(<SitterRibbon sitters={[sitter()]} status="error" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no sitters", () => {
    const { container } = render(<SitterRibbon sitters={[sitter({ is_sitter: false })]} status="ready" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("chips", () => {
  it("links each sitter to their profile with first name, city and starting price", () => {
    const one = sitter({ id: "kristina", full_name: "Kristina Poškutė" });
    render(<SitterRibbon sitters={[one]} status="ready" />);
    const chip = screen.getByRole("link", { name: /Kristina/ });
    expect(chip).toHaveAttribute("href", "/browse/kristina");
    expect(chip.textContent).toContain("Kristina");
    expect(chip.textContent).not.toContain("Poškutė");
    expect(chip.textContent).toContain("Kaunas · common.pricing.from €10");
  });

  it("puts sitters with a photo before those without", () => {
    const noPhoto = sitter({ id: "no-photo", full_name: "Aaa Initials", avatar_url: null, experience_years: 20 });
    const withPhoto = sitter({ id: "with-photo", full_name: "Zzz Photo", experience_years: 1 });
    render(<SitterRibbon sitters={[noPhoto, withPhoto]} status="ready" />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href")).filter((h) => h?.startsWith("/browse/"));
    expect(hrefs).toEqual(["/browse/with-photo", "/browse/no-photo"]);
  });

  it("counts every sitter, not just the chips shown", () => {
    const many = Array.from({ length: 15 }, () => sitter());
    render(<SitterRibbon sitters={many} status="ready" />);
    expect(screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/browse/"))).toHaveLength(12);
    expect(screen.getByText(/home\.ribbon\.count\.other/)).toBeInTheDocument();
  });
});
