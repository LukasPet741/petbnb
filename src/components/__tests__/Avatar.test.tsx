import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Avatar from "@/components/Avatar";

// Avatar is a pure, server-compatible component with no hooks and no context,
// so everything here is asserted on real rendered output.

/** The initials tile is the only div rendered in the no-url branch. */
function tile(container: HTMLElement): HTMLElement {
  const el = container.querySelector("div");
  if (!el) throw new Error("expected an initials tile");
  return el;
}

const BG_CLASSES = [
  "bg-brand-soft",
  "bg-amber-100",
  "bg-sky-100",
  "bg-rose-100",
  "bg-violet-100",
  "bg-teal-100",
];

const backgroundOf = (el: HTMLElement) =>
  BG_CLASSES.filter((c) => el.classList.contains(c));

describe("initials", () => {
  it("takes the first letter of each of the first two words", () => {
    const { container } = render(<Avatar name="Jonas Petraitis" />);
    expect(tile(container)).toHaveTextContent("JP");
  });

  it("uppercases lowercase input", () => {
    const { container } = render(<Avatar name="jonas petraitis" />);
    expect(tile(container)).toHaveTextContent("JP");
  });

  it("uses a single initial for a one-word name", () => {
    const { container } = render(<Avatar name="Jonas" />);
    expect(tile(container)).toHaveTextContent("J");
  });

  it("ignores words beyond the second", () => {
    const { container } = render(<Avatar name="Ana Maria de Souza" />);
    expect(tile(container)).toHaveTextContent("AM");
  });

  it("preserves Lithuanian diacritics when uppercasing", () => {
    const { container } = render(<Avatar name="Ąžuolas Šarūnas" />);
    expect(tile(container)).toHaveTextContent("ĄŠ");
  });

  // BUG: split(" ") on a doubled space yields an empty middle segment, whose
  // first character is undefined. slice(0, 2) then keeps ["J", undefined] and
  // join("") renders it as just "J" - a two-word name showing one initial.
  // Correct behaviour would be to split on /\s+/ after trimming.
  it("renders only one initial when a name has a doubled space (current buggy behaviour)", () => {
    const { container } = render(<Avatar name="Jonas  Petraitis" />);
    expect(tile(container)).toHaveTextContent("J");
  });

  // BUG: a leading space produces an empty first segment, so the initials come
  // from the wrong words AND getColor keys off the space character.
  it("drops the first initial when a name has a leading space (current buggy behaviour)", () => {
    const { container } = render(<Avatar name=" Ann Smith" />);
    expect(tile(container)).toHaveTextContent("A");
  });

  // BUG: "".charCodeAt(0) is NaN, and "".split(" ") is [""], so the tile has
  // neither initials nor a background colour - a completely blank circle.
  // Reachable from SitterMini, which passes sitter.full_name with no fallback
  // (SitterCard, by contrast, guards it with ?? t("appShell.sitterFallback")).
  it("renders a blank circle for an empty name (current buggy behaviour)", () => {
    const { container } = render(<Avatar name="" />);
    expect(tile(container)).toHaveTextContent("");
  });

  it("splits an astral first character into a lone surrogate (current buggy behaviour)", () => {
    // n[0] indexes UTF-16 code units, so an emoji yields half a surrogate pair
    // and renders as a replacement character.
    const { container } = render(<Avatar name="🐶 Rex" />);
    const text = tile(container).textContent ?? "";
    expect(text).not.toBe("🐶R");
    expect(text.codePointAt(0)).toBeGreaterThanOrEqual(0xd800);
  });

  // BUG: the prop is typed `string`, but Profile.full_name is `string | null`
  // in the generated Database row type. FeaturedSitterHero passes it through
  // unguarded, which is the one call site that can actually hit this.
  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("throws a TypeError when the name is %s (current buggy behaviour)", (_label, value) => {
    expect(() => render(<Avatar name={value as unknown as string} />)).toThrow(
      TypeError,
    );
  });
});

describe("background colour", () => {
  it("is deterministic for the same name", () => {
    const a = render(<Avatar name="Jonas" />);
    const first = backgroundOf(tile(a.container));
    a.unmount();
    const b = render(<Avatar name="Jonas" />);
    expect(backgroundOf(tile(b.container))).toEqual(first);
  });

  it("assigns exactly one colour from the palette for an ordinary name", () => {
    const { container } = render(<Avatar name="Jonas" />);
    expect(backgroundOf(tile(container))).toHaveLength(1);
  });

  it.each([
    // charCodeAt(0) % 6 selects the palette entry.
    ["bg-brand-soft", "B"], // 66 % 6 = 0
    ["bg-amber-100", "C"], // 67 % 6 = 1
    ["bg-sky-100", "D"], // 68 % 6 = 2
    ["bg-rose-100", "E"], // 69 % 6 = 3
    ["bg-violet-100", "F"], // 70 % 6 = 4
    ["bg-teal-100", "A"], // 65 % 6 = 5
  ])("uses %s for a name starting with %s", (expected, name) => {
    const { container } = render(<Avatar name={name} />);
    expect(tile(container)).toHaveClass(expected);
  });

  // BUG: COLORS[NaN] is undefined, and cn() silently drops undefined, so the
  // tile renders with no background at all - invisible against the page.
  it("renders no background class at all for an empty name (current buggy behaviour)", () => {
    const { container } = render(<Avatar name="" />);
    expect(backgroundOf(tile(container))).toEqual([]);
  });

  // BUG: getColor reads charCodeAt(0) of the raw string, not of the first
  // initial, so padding changes the colour of the same person's avatar.
  it("gives a padded name a different colour from the unpadded one (current buggy behaviour)", () => {
    const padded = render(<Avatar name=" Ann" />);
    const paddedBg = backgroundOf(tile(padded.container));
    padded.unmount();
    const plain = render(<Avatar name="Ann" />);
    expect(backgroundOf(tile(plain.container))).not.toEqual(paddedBg);
  });
});

describe("image branch", () => {
  it("renders an img when a url is given", () => {
    render(<Avatar name="Jonas Petraitis" url="https://example.com/a.jpg" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/a.jpg");
  });

  it("uses the name as alt text", () => {
    render(<Avatar name="Jonas Petraitis" url="https://example.com/a.jpg" />);
    expect(screen.getByAltText("Jonas Petraitis")).toBeInTheDocument();
  });

  it("marks the image decorative when the name is empty", () => {
    const { container } = render(<Avatar name="" url="https://example.com/a.jpg" />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("lazy-loads and withholds the referrer, since avatars are third-party URLs", () => {
    const { container } = render(<Avatar name="A" url="https://example.com/a.jpg" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("falls back to initials for an empty url", () => {
    const { container } = render(<Avatar name="Jonas" url="" />);
    expect(container.querySelector("img")).toBeNull();
    expect(tile(container)).toHaveTextContent("J");
  });

  it("falls back to initials for a null url", () => {
    const { container } = render(<Avatar name="Jonas" url={null} />);
    expect(tile(container)).toHaveTextContent("J");
  });

  // A whitespace url is truthy, so it takes the image branch and renders a
  // broken image. There is no onError fallback anywhere in this component.
  it("treats a whitespace-only url as present (current behaviour)", () => {
    const { container } = render(<Avatar name="Jonas" url="   " />);
    expect(container.querySelector("img")).not.toBeNull();
  });
});

describe("sizing", () => {
  it.each([
    ["sm", "w-8", "h-8", "text-xs"],
    ["md", "w-10", "h-10", "text-sm"],
    ["lg", "w-14", "h-14", "text-base"],
    ["xl", "w-20", "h-20", "text-2xl"],
  ] as const)("applies the %s size classes", (size, w, h, text) => {
    const { container } = render(<Avatar name="A" size={size} />);
    expect(tile(container)).toHaveClass(w, h, text);
  });

  it("defaults to the medium size", () => {
    const { container } = render(<Avatar name="A" />);
    expect(tile(container)).toHaveClass("w-10", "h-10", "text-sm");
  });

  it("lets a className override beat the size preset via twMerge", () => {
    // FeaturedSitterHero relies on this, passing w-40 h-40 text-5xl over xl.
    const { container } = render(
      <Avatar name="A" size="xl" className="w-40 h-40 text-5xl" />,
    );
    const el = tile(container);
    expect(el).toHaveClass("w-40", "h-40", "text-5xl");
    expect(el).not.toHaveClass("w-20", "h-20", "text-2xl");
  });

  it("applies size classes to the image branch too", () => {
    const { container } = render(
      <Avatar name="A" url="https://example.com/a.jpg" size="lg" />,
    );
    expect(container.querySelector("img")).toHaveClass("w-14", "h-14");
  });
});
