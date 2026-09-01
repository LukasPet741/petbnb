import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import Logo, { LogoMark } from "@/components/Logo";
import Atmosphere from "@/components/Atmosphere";

// Five presentational components: no hooks, no context, no client-only APIs, so
// every assertion here is on real rendered DOM. The interesting seam between
// them is HOW each one composes classes - Badge and FavoriteButton go through
// cn()/twMerge (which silently drops undefined), while EmptyState and Logo
// interpolate straight into a template literal (which stringifies it). The two
// invalid-prop tests below pin that contrast.

/** A stand-in for a lucide icon: it must forward the className it is given. */
function TestIcon({ className }: { className?: string }) {
  return <svg data-testid="icon" className={className} />;
}

describe("Badge", () => {
  it("renders its children inside a pill span", () => {
    render(<Badge>Verified</Badge>);
    const badge = screen.getByText("Verified");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveClass(
      "inline-flex",
      "items-center",
      "px-2.5",
      "py-0.5",
      "rounded-full",
      "text-xs",
      "font-medium",
    );
  });

  // Note: nothing in the app renders a Badge without an explicit variant, so
  // this stone default is dead styling today - it is still the fallback the
  // component promises.
  it("falls back to the stone default variant when no variant is given", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-stone-100", "text-stone-700");
  });

  it("applies the brand variant classes and not the default ones", () => {
    render(<Badge variant="brand">Brand</Badge>);
    const badge = screen.getByText("Brand");
    expect(badge).toHaveClass("bg-brand-soft", "text-brand-strong");
    expect(badge).not.toHaveClass("bg-stone-100");
  });

  it("silently renders an unstyled pill for an unknown variant, with no literal 'undefined' class", () => {
    // VARIANTS["ghost"] is undefined and cn() drops undefined entries, so the
    // badge simply loses its colours instead of emitting a broken class.
    // Contrast with EmptyState's invalid tone, below.
    render(<Badge variant={"ghost" as unknown as "brand"}>Ghost</Badge>);
    const badge = screen.getByText("Ghost");
    expect(badge.className).not.toContain("undefined");
    expect(badge).not.toHaveClass("bg-stone-100");
    expect(badge).not.toHaveClass("bg-brand-soft");
    expect(badge).toHaveClass("rounded-full");
  });

  it("renders an empty pill for null children", () => {
    const { container } = render(<Badge>{null}</Badge>);
    const badge = container.querySelector("span");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("");
  });

  it("renders the number zero rather than dropping it", () => {
    const { container } = render(<Badge>{0}</Badge>);
    // A falsy-but-meaningful child: a count badge showing 0 must not go blank.
    expect(container.querySelector("span")?.textContent).toBe("0");
  });

  it("renders an empty pill for an empty-string child", () => {
    const { container } = render(<Badge>{""}</Badge>);
    expect(container.querySelector("span")?.textContent).toBe("");
  });

  it("renders an element child inside the pill", () => {
    render(
      <Badge variant="brand">
        <strong>New</strong>
      </Badge>,
    );
    const strong = screen.getByText("New");
    expect(strong.tagName).toBe("STRONG");
    expect(strong.parentElement).toHaveClass("bg-brand-soft");
  });

  it("renders an array of children in order", () => {
    const { container } = render(<Badge>{["2", " ", "pets"]}</Badge>);
    expect(container.querySelector("span")?.textContent).toBe("2 pets");
  });

  it("lets a caller's padding and radius beat the base ones via twMerge", () => {
    render(
      <Badge variant="brand" className="px-1 rounded-md">
        Tight
      </Badge>,
    );
    const badge = screen.getByText("Tight");
    expect(badge).toHaveClass("px-1", "rounded-md");
    expect(badge).not.toHaveClass("px-2.5");
    expect(badge).not.toHaveClass("rounded-full");
    // Non-conflicting utilities survive.
    expect(badge).toHaveClass("py-0.5", "text-xs", "bg-brand-soft");
  });
});

describe("EmptyState", () => {
  /**
   * The icon tile is the first div inside the card. Note that RTL's own
   * container is a div, so a "div > div" selector would match the card itself
   * rather than the tile - hence selecting on the tile's own size class.
   */
  function tile(container: HTMLElement): HTMLElement {
    const el = container.querySelector(".w-14");
    if (!el) throw new Error("expected an icon tile");
    return el as HTMLElement;
  }

  it("renders the title and the icon inside the card shell", () => {
    const { container } = render(<EmptyState icon={TestIcon} title="No bookings yet" />);
    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("bg-surface", "rounded-2xl", "text-center");
  });

  it("sizes the caller's icon component through its className prop", () => {
    render(<EmptyState icon={TestIcon} title="No bookings yet" />);
    expect(screen.getByTestId("icon")).toHaveClass("w-7", "h-7");
  });

  it("uses the brand tone by default", () => {
    const { container } = render(<EmptyState icon={TestIcon} title="Empty" />);
    expect(tile(container)).toHaveClass("bg-brand-soft", "text-brand");
  });

  it("maps the encouraging tone to the amber classes", () => {
    const { container } = render(<EmptyState icon={TestIcon} title="Empty" tone="encouraging" />);
    const el = tile(container);
    expect(el).toHaveClass("bg-amber-soft", "text-amber-strong");
    expect(el).not.toHaveClass("bg-brand-soft");
  });

  it("maps the error tone to the danger classes", () => {
    const { container } = render(<EmptyState icon={TestIcon} title="Empty" tone="error" />);
    const el = tile(container);
    expect(el).toHaveClass("bg-danger-soft", "text-danger");
    expect(el).not.toHaveClass("bg-brand-soft");
  });

  // BUG: toneClasses[tone] is interpolated into a template literal instead of
  // passed through cn(), so an unknown tone stringifies to the literal word
  // "undefined" and ships in the class attribute: the tile renders with no
  // colour AND a junk class name. Badge, one describe block up, hits the same
  // invalid-key case through cn() and degrades cleanly. Correct behaviour would
  // be cn("...", toneClasses[tone]) - or a `?? toneClasses.neutral` fallback.
  it("puts the literal string 'undefined' in the class attribute for an unknown tone (current buggy behaviour)", () => {
    const { container } = render(
      // Intentionally invalid: exactly what a typo or stale prop value produces.
      <EmptyState icon={TestIcon} title="Empty" tone={"warning" as unknown as "error"} />,
    );
    const el = tile(container);
    expect(el.className).toContain("undefined");
    expect(el).toHaveClass("undefined");
    expect(el).not.toHaveClass("bg-brand-soft");
  });

  it("renders neither description nor action when both are omitted", () => {
    const { container } = render(<EmptyState icon={TestIcon} title="Title only" />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the description paragraph when only a description is given", () => {
    const { container } = render(
      <EmptyState icon={TestIcon} title="Title" description="Try widening your search." />,
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1]).toHaveTextContent("Try widening your search.");
    expect(paragraphs[1]).toHaveClass("text-ink-soft", "text-sm", "max-w-sm");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a centred action row when only an action is given", () => {
    const { container } = render(
      <EmptyState icon={TestIcon} title="Title" action={<button type="button">Find a sitter</button>} />,
    );
    expect(container.querySelectorAll("p")).toHaveLength(1);
    const action = screen.getByRole("button", { name: "Find a sitter" });
    expect(action.parentElement).toHaveClass("mt-5", "flex", "justify-center");
  });

  it("renders the description above the action when both are given", () => {
    const { container } = render(
      <EmptyState
        icon={TestIcon}
        title="No pets yet"
        description="Add your first pet to get started."
        action={<button type="button">Add a pet</button>}
      />,
    );
    expect(container.textContent).toBe("No pets yetAdd your first pet to get started.Add a pet");
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add a pet" })).toBeInTheDocument();
  });

  it("renders an empty description as no paragraph at all", () => {
    // "" is falsy, so the && short-circuits - a blank description string is
    // indistinguishable from omitting it.
    const { container } = render(<EmptyState icon={TestIcon} title="Title" description="" />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});

describe("PageHeader", () => {
  it("renders the title as the only heading, untruncated", () => {
    render(<PageHeader title="Your bookings" />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Your bookings" });
    expect(h1).toHaveClass("font-display", "text-3xl", "sm:text-4xl", "tracking-tight");
    // No `truncate`: a long page title must wrap rather than be clipped.
    expect(h1).not.toHaveClass("truncate");
  });

  it("renders neither subtitle nor action when both are omitted", () => {
    const { container } = render(<PageHeader title="Your bookings" />);
    expect(container.querySelector("p")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // Only the text column survives inside the header row.
    expect(container.firstElementChild?.children).toHaveLength(1);
  });

  it("renders the subtitle paragraph when only a subtitle is given", () => {
    const { container } = render(<PageHeader title="Your bookings" subtitle="Past and upcoming" />);
    const p = container.querySelector("p");
    expect(p).toHaveTextContent("Past and upcoming");
    expect(p).toHaveClass("text-ink-soft", "mt-2");
    expect(container.firstElementChild?.children).toHaveLength(1);
  });

  it("renders the action beside the title when only an action is given", () => {
    const { container } = render(
      <PageHeader title="Your pets" action={<button type="button">Add a pet</button>} />,
    );
    expect(container.querySelector("p")).toBeNull();
    expect(screen.getByRole("button", { name: "Add a pet" })).toBeInTheDocument();
    expect(container.firstElementChild?.children).toHaveLength(2);
  });

  it("renders subtitle and action together in title, subtitle, action order", () => {
    const { container } = render(
      <PageHeader
        title="Your pets"
        subtitle="Two in your household"
        action={<button type="button">Add a pet</button>}
      />,
    );
    expect(container.textContent).toBe("Your petsTwo in your householdAdd a pet");
  });

  it("lets the text column shrink and keeps the action at full width", () => {
    const { container } = render(
      <PageHeader
        title="A very long page title that would otherwise push the action off screen"
        action={<button type="button">Add a pet</button>}
      />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row).toHaveClass("flex", "items-start", "justify-between", "gap-4");
    // min-w-0 is what actually lets the flex text column shrink below its
    // content width; flex-shrink-0 is what stops the CTA collapsing.
    expect(row.children[0]).toHaveClass("min-w-0");
    expect(row.children[1]).toHaveClass("flex-shrink-0");
  });
});

describe("Logo", () => {
  it("renders the mark as an image with a PetBnB accessible name", () => {
    render(<Logo />);
    const svg = screen.getByRole("img", { name: "PetBnB" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
    expect(svg).toHaveAttribute("viewBox", "0 0 120 120");
  });

  it("renders the mark alone by default, with no wordmark text", () => {
    const { container } = render(<Logo />);
    expect(container.textContent).toBe("");
    expect(screen.queryByText("PetBnB")).not.toBeInTheDocument();
  });

  it("renders the PetBnB wordmark when asked", () => {
    render(<Logo showWordmark />);
    const wordmark = screen.getByText("PetBnB");
    expect(wordmark).toHaveClass("font-display", "font-semibold", "tracking-tight", "text-ink");
  });

  it.each([
    [32, "18px"],
    [28, "16px"],
    [40, "22px"],
    [33, "18px"],
    [0, "0px"],
  ])("scales the wordmark to round(size * 0.56) for size %i", (size, fontSize) => {
    render(<Logo size={size} showWordmark />);
    // 32*0.56 = 17.92 -> 18; 28*0.56 = 15.68 -> 16; 40*0.56 = 22.4 -> 22;
    // 33*0.56 = 18.48 -> 18; 0 -> 0, i.e. an invisible wordmark next to an
    // invisible mark rather than a fallback size.
    expect(screen.getByText("PetBnB").style.fontSize).toBe(fontSize);
  });

  it("sizes the svg to the requested pixel size", () => {
    render(<Logo size={48} />);
    const svg = screen.getByRole("img", { name: "PetBnB" });
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });

  it("lets wordmarkClassName replace the default ink colour", () => {
    render(<Logo showWordmark wordmarkClassName="text-white" />);
    const wordmark = screen.getByText("PetBnB");
    // Plain template interpolation, not twMerge: the default is replaced
    // outright rather than merged, so text-ink is gone entirely.
    expect(wordmark).toHaveClass("text-white");
    expect(wordmark).not.toHaveClass("text-ink");
  });

  it("adds className to the outer wrapper without dropping its layout classes", () => {
    const { container } = render(<Logo className="gap-4" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass("inline-flex", "items-center", "gap-2", "gap-4");
  });

  it("exports LogoMark on its own, defaulting to 32px", () => {
    render(<LogoMark />);
    const svg = screen.getByRole("img", { name: "PetBnB" });
    expect(svg).toHaveAttribute("width", "32");
    // The mark is built from primitives whose colours come from CSS tokens.
    expect(svg.querySelectorAll("circle")).toHaveLength(3);
    expect(svg.querySelectorAll("rect")).toHaveLength(2);
    expect(svg.innerHTML).toContain("var(--brand)");
  });
});

describe("Atmosphere", () => {
  it("is hidden from assistive tech and inert to the pointer", () => {
    const { container } = render(<Atmosphere />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.style.pointerEvents).toBe("none");
    expect(root.style.position).toBe("fixed");
    // Nothing focusable and nothing readable: it is pure atmosphere.
    expect(container.textContent).toBe("");
  });

  it("stacks the bloom layer behind the grain layer, both behind the page", () => {
    const { container } = render(<Atmosphere />);
    const layers = Array.from(
      (container.firstElementChild as HTMLElement).children,
    ) as HTMLElement[];
    expect(layers).toHaveLength(2);
    expect(layers[0].style.zIndex).toBe("-2");
    expect(layers[1].style.zIndex).toBe("-1");
    // Negative z-index is what puts them behind the content of every page.
    expect(layers.every((l) => l.style.pointerEvents === "none")).toBe(true);
    expect(layers.every((l) => l.style.position === "fixed")).toBe(true);
  });

  it("blends the grain layer at a low opacity so it reads as paper, not texture", () => {
    // Only the properties jsdom can actually represent are asserted here.
    // Its CSS parser silently drops both the `background` shorthand carrying
    // radial-gradient() and the `background-image` data URI - they do not even
    // survive into the style attribute - so the bloom gradients and the grain
    // SVG cannot be checked in this environment. The visual layering contract
    // is covered by the z-index/position test above instead.
    const { container } = render(<Atmosphere />);
    const [, grain] = Array.from(
      (container.firstElementChild as HTMLElement).children,
    ) as HTMLElement[];
    expect(grain.style.mixBlendMode).toBe("overlay");
    expect(grain.style.opacity).toBe("0.045");
  });
});
