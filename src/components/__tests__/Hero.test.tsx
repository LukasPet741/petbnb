import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Hero from "@/components/home/Hero";
import type { Profile } from "@/lib/types";

// The hero pushes to the router on search, so this file needs a handle on push
// rather than the throwaway mock in vitest.setup.ts.
const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

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
    about_me: "I have looked after dogs for years.",
    avatar_url: "https://x/a.jpg",
    last_active_at: "2026-09-01T10:00:00Z",
    ...over,
  } as Profile;
}

beforeEach(() => {
  seq = 0;
  h.push.mockReset();
});

const searchBox = () => screen.getByRole("textbox");
const submit = () => screen.getByRole("button", { name: /home\.hero\.searchButton/ });

describe("copy", () => {
  it("renders the fixed headline rather than a sitter's bio", () => {
    // The old hero used a random sitter's about_me as the h1, which made the
    // page's only heading unpredictable and often four lines long.
    render(<Hero sitters={[]} status="ready" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("home.hero.titleLine1");
    expect(heading.textContent).toContain("home.hero.titleLine2");
  });

  it("renders exactly one h1", () => {
    render(<Hero sitters={[sitter()]} status="ready" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("pinboard", () => {
  it("shows five tiles even when no sitter has a photo, so the grid has no hole", () => {
    const { container } = render(
      <Hero sitters={[sitter({ avatar_url: null })]} status="ready" />
    );
    expect(container.querySelectorAll("img")).toHaveLength(5);
  });

  it("fills tiles with real sitter photos first", () => {
    const { container } = render(
      <Hero sitters={[sitter({ avatar_url: "https://x/face.jpg" })]} status="ready" />
    );
    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(srcs[0]).toBe("https://x/face.jpg");
  });

  it("tops the board up with curated photography when sitters run out", () => {
    const { container } = render(
      <Hero sitters={[sitter({ avatar_url: "https://x/face.jpg" })]} status="ready" />
    );
    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(srcs.filter((s) => s?.includes("unsplash"))).toHaveLength(4);
  });

  it("names the sitter in the alt text of their own tile", () => {
    render(<Hero sitters={[sitter({ full_name: "Rūta Jankauskienė" })]} status="ready" />);
    expect(screen.getByAltText("Rūta Jankauskienė")).toBeInTheDocument();
  });

  it("falls back to descriptive alt text on a filler tile", () => {
    render(<Hero sitters={[]} status="ready" />);
    expect(screen.getAllByAltText("home.hero.fallbackImageAlt")).toHaveLength(5);
  });

  it("shows skeletons and no photographs while the query is in flight", () => {
    const { container } = render(<Hero sitters={[]} status="loading" />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });

  it("still renders the board when the query failed, using fillers", () => {
    // The hero's job is the search box. A failed sitter query must not blank it.
    const { container } = render(<Hero sitters={[]} status="error" />);
    expect(container.querySelectorAll("img")).toHaveLength(5);
  });
});

describe("search form", () => {
  it("is present in every status", () => {
    for (const status of ["loading", "error", "ready"] as const) {
      const { unmount } = render(<Hero sitters={[]} status={status} />);
      expect(searchBox()).toBeInTheDocument();
      unmount();
    }
  });

  it("navigates to the bare sitters route for an empty query", async () => {
    const user = userEvent.setup();
    render(<Hero sitters={[]} status="ready" />);
    await user.click(submit());
    expect(h.push).toHaveBeenCalledWith("/sitters");
  });

  it("navigates to the bare sitters route for a whitespace-only query", async () => {
    const user = userEvent.setup();
    render(<Hero sitters={[]} status="ready" />);
    await user.type(searchBox(), "   ");
    await user.click(submit());
    expect(h.push).toHaveBeenCalledWith("/sitters");
  });

  it("percent-encodes a Lithuanian city name", async () => {
    const user = userEvent.setup();
    render(<Hero sitters={[]} status="ready" />);
    await user.type(searchBox(), "Klaipėda");
    await user.click(submit());
    expect(h.push).toHaveBeenCalledWith("/sitters?city=Klaip%C4%97da");
  });

  it.each([
    ["an ampersand and equals", "a&b=c", "/sitters?city=a%26b%3Dc"],
    ["a fragment character", "a#b", "/sitters?city=a%23b"],
    ["a traversal attempt", "../../etc", "/sitters?city=..%2F..%2Fetc"],
  ])("encodes %s rather than letting it alter the URL", async (_label, input, expected) => {
    const user = userEvent.setup();
    render(<Hero sitters={[]} status="ready" />);
    await user.type(searchBox(), input);
    await user.click(submit());
    expect(h.push).toHaveBeenCalledWith(expected);
  });

  it("carries the phone keyboard hints the forms lens added", () => {
    render(<Hero sitters={[]} status="ready" />);
    const input = searchBox();
    expect(input).toHaveAttribute("inputMode", "search");
    expect(input).toHaveAttribute("enterKeyHint", "search");
    expect(input).toHaveAttribute("autoComplete", "address-level2");
  });
});
