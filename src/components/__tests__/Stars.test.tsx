import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Stars, { starFill } from "@/components/Stars";

// Stars touches no Supabase and no router — only useLanguage, for the aria-label.
// Rendered without a LanguageProvider the default context's `t` is the identity
// function, so the label below IS the translation key the component asked for.

describe("starFill", () => {
  /**
   * The visual rounds to the nearest half star while the exact average is printed
   * beside it, so the picture is never more than a quarter star away from the
   * number a reader can see. Every boundary is pinned because "looks about right"
   * is exactly how a rounding rule rots.
   */
  it.each([
    ["a bottom-of-range rating", 1, 1],
    ["a whole rating", 4, 4],
    ["just below the half-star boundary", 4.24, 4],
    ["exactly on the half-star boundary", 4.25, 4.5],
    ["just below the next whole star", 4.74, 4.5],
    ["exactly on the whole-star boundary", 4.75, 5],
    ["a near-perfect rating", 4.8, 5],
    ["a perfect rating", 5, 5],
  ])("rounds %s to the nearest half", (_label, input, expected) => {
    expect(starFill(input)).toBe(expected);
  });

  it("clamps a rating below the range rather than rendering negative stars", () => {
    // The column has a CHECK constraint, but this number also arrives from a view
    // and from seed data — the same reason averageRating() discards out-of-range.
    expect(starFill(0)).toBe(0);
    expect(starFill(-3)).toBe(0);
  });

  it("clamps a rating above the range rather than overflowing the row", () => {
    expect(starFill(7)).toBe(5);
  });

  it("treats a non-finite rating as unrated rather than rendering NaN stars", () => {
    expect(starFill(Number.NaN)).toBe(0);
    expect(starFill(Number.POSITIVE_INFINITY)).toBe(5);
  });
});

describe("Stars", () => {
  const states = (container: HTMLElement) =>
    [...container.querySelectorAll("[data-star]")].map((el) => el.getAttribute("data-star"));

  it("always renders exactly five slots, so the row never changes width", () => {
    const { container } = render(<Stars value={2} />);
    expect(states(container)).toHaveLength(5);
  });

  it("fills whole stars up to the rating and leaves the rest empty", () => {
    const { container } = render(<Stars value={3} />);
    expect(states(container)).toEqual(["full", "full", "full", "empty", "empty"]);
  });

  it("renders a half star for a rating that rounds to a half", () => {
    const { container } = render(<Stars value={3.5} />);
    expect(states(container)).toEqual(["full", "full", "full", "half", "empty"]);
  });

  it("renders five full stars for a perfect rating", () => {
    const { container } = render(<Stars value={5} />);
    expect(states(container)).toEqual(["full", "full", "full", "full", "full"]);
  });

  it("renders five empty stars for a zero rating rather than rendering nothing", () => {
    // Stars itself is dumb: deciding that an unrated sitter shows no stars at all
    // belongs to RatingSummary, which is the component that knows the count.
    const { container } = render(<Stars value={0} />);
    expect(states(container)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
  });

  it("exposes one labelled image to assistive tech instead of five bare icons", () => {
    render(<Stars value={4} />);
    // Identity `t`, so this asserts which key the component requests.
    expect(screen.getByRole("img")).toHaveAccessibleName("sitters.reviews.starsAriaLabel");
  });

  it("hides the individual icons from assistive tech", () => {
    const { container } = render(<Stars value={4} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
