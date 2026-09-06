import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CityGrid from "@/components/home/CityGrid";
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
    about_me: "Bio.",
    avatar_url: "https://x/a.jpg",
    last_active_at: "2026-09-01T10:00:00Z",
    ...over,
  } as Profile;
}

const link = (name: RegExp | string) => screen.getByRole("link", { name });

describe("states", () => {
  it("renders skeleton cells while loading", () => {
    const { container } = render(<CityGrid sitters={[]} status="loading" />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });

  it("renders an error state when the query failed", () => {
    render(<CityGrid sitters={[]} status="error" />);
    expect(screen.getByText("home.cities.errorTitle")).toBeInTheDocument();
  });

  it("renders an encouraging empty state when no sitter has a city", () => {
    render(<CityGrid sitters={[sitter({ city: "" })]} status="ready" />);
    expect(screen.getByText("home.cities.emptyTitle")).toBeInTheDocument();
  });

  it("does not show the empty state once a city exists", () => {
    render(<CityGrid sitters={[sitter({ city: "Kaunas" })]} status="ready" />);
    expect(screen.queryByText("home.cities.emptyTitle")).not.toBeInTheDocument();
  });
});

describe("cities", () => {
  it("lists each city once, folding case variants together", () => {
    render(
      <CityGrid
        sitters={[sitter({ city: "Kaunas" }), sitter({ city: "kaunas" })]}
        status="ready"
      />
    );
    expect(screen.getAllByRole("heading", { level: 3, name: "Kaunas" })).toHaveLength(1);
  });

  it("links a city to its filtered sitter list, percent-encoded", () => {
    render(<CityGrid sitters={[sitter({ city: "Klaipėda" })]} status="ready" />);
    expect(link(/Klaipėda/)).toHaveAttribute("href", "/sitters?city=Klaip%C4%97da");
  });

  it("links the section header to the unfiltered list", () => {
    render(<CityGrid sitters={[sitter()]} status="ready" />);
    expect(link(/home\.cities\.seeAll/)).toHaveAttribute("href", "/sitters");
  });

  it("caps the grid at five cities so the bento has no spare cell", () => {
    const cities = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus"];
    render(<CityGrid sitters={cities.map((city) => sitter({ city }))} status="ready" />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
  });

  it("puts the busiest city in the lead cell, which carries the photograph", () => {
    const { container } = render(
      <CityGrid
        sitters={[sitter({ city: "Vilnius" }), sitter({ city: "Kaunas" }), sitter({ city: "Kaunas" })]}
        status="ready"
      />
    );
    expect(screen.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("Kaunas");
    // Exactly one decorative photo: the lead cell's. The rest stay plain, and a
    // second image here would mean the scrim is missing from one of them.
    expect(container.querySelectorAll('img[aria-hidden="true"]')).toHaveLength(1);
  });
});

describe("counts", () => {
  it("uses the singular form for one sitter", () => {
    render(<CityGrid sitters={[sitter({ city: "Alytus" })]} status="ready" />);
    expect(screen.getByText("home.cities.sitterCount.one")).toBeInTheDocument();
  });

  it("uses the plural form for several sitters in English", () => {
    // English has no "few" category, so anything above one resolves to "other".
    render(
      <CityGrid
        sitters={[sitter({ city: "Kaunas" }), sitter({ city: "Kaunas" })]}
        status="ready"
      />
    );
    expect(screen.getByText("home.cities.sitterCount.other")).toBeInTheDocument();
  });
});

describe("avatar stack", () => {
  it("shows at most four faces and counts the remainder", () => {
    const sitters = Array.from({ length: 7 }, () => sitter({ city: "Vilnius" }));
    render(<CityGrid sitters={sitters} status="ready" />);
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("shows no remainder badge when every sitter fits", () => {
    render(<CityGrid sitters={[sitter({ city: "Vilnius" })]} status="ready" />);
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("falls back to initials tiles when nobody in the city has a photo", () => {
    render(
      <CityGrid sitters={[sitter({ city: "Vilnius", full_name: "Jonas Petraitis", avatar_url: null })]} status="ready" />
    );
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("does not crash on a sitter with a null name", () => {
    // Profile.full_name is nullable in the database row type, and Avatar splits
    // on it unguarded.
    render(
      <CityGrid
        sitters={[sitter({ city: "Vilnius", full_name: null as unknown as string, avatar_url: null })]}
        status="ready"
      />
    );
    expect(screen.getByRole("heading", { level: 3, name: "Vilnius" })).toBeInTheDocument();
  });
});
