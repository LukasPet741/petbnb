import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SitterVoices from "@/components/home/SitterVoices";
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
    about_me: "I walk dogs every morning before work.",
    avatar_url: "https://x/a.jpg",
    last_active_at: "2026-09-01T10:00:00Z",
    ...over,
  } as Profile;
}

describe("states", () => {
  it("renders skeletons while loading", () => {
    const { container } = render(<SitterVoices sitters={[]} status="loading" />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(6);
  });

  it("renders an error state when the query failed", () => {
    render(<SitterVoices sitters={[]} status="error" />);
    expect(screen.getByText("home.voices.errorTitle")).toBeInTheDocument();
  });

  it("renders an empty state when nobody has written a bio", () => {
    render(<SitterVoices sitters={[sitter({ about_me: "" })]} status="ready" />);
    expect(screen.getByText("home.voices.emptyTitle")).toBeInTheDocument();
  });
});

describe("quotes", () => {
  it("quotes the sitter's own words, in typographic quote marks", () => {
    render(<SitterVoices sitters={[sitter({ about_me: "I walk dogs at dawn." })]} status="ready" />);
    expect(screen.getByText("“I walk dogs at dawn.”")).toBeInTheDocument();
  });

  it("collapses the whitespace a pasted bio carries", () => {
    render(<SitterVoices sitters={[sitter({ about_me: "  Two\n\nlines.  " })]} status="ready" />);
    expect(screen.getByText("“Two lines.”")).toBeInTheDocument();
  });

  it("caps a very long bio rather than letting one voice run the column", () => {
    render(<SitterVoices sitters={[sitter({ about_me: "word ".repeat(200) })]} status="ready" />);
    const quote = screen.getByRole("figure").querySelector("blockquote");
    // 200 characters of bio, plus the two quote marks and the ellipsis.
    expect(quote?.textContent?.length).toBeLessThanOrEqual(204);
  });

  it("clamps the quote to three lines so no card towers over the others", () => {
    render(<SitterVoices sitters={[sitter()]} status="ready" />);
    expect(screen.getByRole("figure").querySelector("blockquote")).toHaveClass("line-clamp-3");
  });

  it("shows at most six voices", () => {
    render(<SitterVoices sitters={Array.from({ length: 10 }, () => sitter())} status="ready" />);
    expect(screen.getAllByRole("figure")).toHaveLength(6);
  });
});

describe("attribution", () => {
  it("signs each quote with the sitter's name and city", () => {
    render(<SitterVoices sitters={[sitter({ full_name: "Rūta Jankauskienė", city: "Kaunas" })]} status="ready" />);
    expect(screen.getByText("Rūta Jankauskienė")).toBeInTheDocument();
    expect(screen.getByText("Kaunas")).toBeInTheDocument();
  });

  it("links a voice to that sitter's profile", () => {
    render(<SitterVoices sitters={[sitter({ id: "abc-123" })]} status="ready" />);
    expect(screen.getByRole("link", { name: /home\.voices\.openProfile/ })).toHaveAttribute(
      "href",
      "/sitters/abc-123"
    );
  });

  it("falls back to a generic name rather than crashing on a null one", () => {
    // Avatar splits on the name unguarded, and Profile.full_name is nullable.
    render(
      <SitterVoices sitters={[sitter({ full_name: null as unknown as string })]} status="ready" />
    );
    expect(screen.getByText("appShell.sitterFallback")).toBeInTheDocument();
  });

  it("links the section header to the full list", () => {
    render(<SitterVoices sitters={[sitter()]} status="ready" />);
    expect(screen.getByRole("link", { name: /home\.voices\.seeAll/ })).toHaveAttribute(
      "href",
      "/sitters"
    );
  });
});
