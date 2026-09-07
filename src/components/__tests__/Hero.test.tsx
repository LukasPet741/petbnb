import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Hero from "@/components/home/Hero";

// The hero pushes to the router on search, so this file needs a handle on push
// rather than the throwaway mock in vitest.setup.ts.
const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

beforeEach(() => {
  h.push.mockReset();
});

const searchBox = () => screen.getByRole("textbox");
const submit = () => screen.getByRole("button", { name: /home\.hero\.searchButton/ });

describe("copy", () => {
  it("renders the fixed headline rather than a sitter's bio", () => {
    // The old hero used a random sitter's about_me as the h1, which made the
    // page's only heading unpredictable and often four lines long.
    render(<Hero />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("home.hero.titleLine1");
    expect(heading.textContent).toContain("home.hero.titleLine2");
  });

  it("renders exactly one h1", () => {
    render(<Hero />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("photograph", () => {
  /**
   * This replaced a five-tile pinboard that read `sitter?.avatar_url ?? FILLERS[i]`.
   * Every seeded sitter has an avatar, so the curated high-resolution photographs
   * were unreachable and the fold rendered five 128px randomuser.me thumbnails
   * upscaled up to 2.67x. The fix is not a better fallback — it is removing the
   * hero's dependency on user-supplied images altogether.
   */

  it("renders exactly one photograph", () => {
    const { container } = render(<Hero />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("uses curated photography, so no user upload can degrade the fold", () => {
    const { container } = render(<Hero />);
    const src = container.querySelector("img")?.getAttribute("src") ?? "";
    expect(src).toContain("images.unsplash.com");
  });

  it("requests the photograph at a size that does not need upscaling", () => {
    // The whole defect was a 128px source stretched across 460px.
    const { container } = render(<Hero />);
    const src = container.querySelector("img")?.getAttribute("src") ?? "";
    const width = Number(new URL(src).searchParams.get("w"));
    expect(width).toBeGreaterThanOrEqual(1200);
  });

  it("describes the photograph for screen readers", () => {
    render(<Hero />);
    expect(screen.getByAltText("home.hero.photoAlt")).toBeInTheDocument();
  });
});

describe("search form", () => {
  it("navigates to the bare sitters route for an empty query", async () => {
    const user = userEvent.setup();
    render(<Hero />);
    await user.click(submit());
    expect(h.push).toHaveBeenCalledWith("/sitters");
  });

  it("navigates to the bare sitters route for a whitespace-only query", async () => {
    const user = userEvent.setup();
    render(<Hero />);
    await user.type(searchBox(), "   ");
    await user.click(submit());
    expect(h.push).toHaveBeenCalledWith("/sitters");
  });

  it("percent-encodes a Lithuanian city name", async () => {
    const user = userEvent.setup();
    render(<Hero />);
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
    render(<Hero />);
    await user.type(searchBox(), input);
    await user.click(submit());
    expect(h.push).toHaveBeenCalledWith(expected);
  });

  it("carries the phone keyboard hints the forms lens added", () => {
    render(<Hero />);
    const input = searchBox();
    expect(input).toHaveAttribute("inputMode", "search");
    expect(input).toHaveAttribute("enterKeyHint", "search");
    expect(input).toHaveAttribute("autoComplete", "address-level2");
  });
});
