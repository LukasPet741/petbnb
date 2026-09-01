import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PetCard from "@/components/PetCard";
import type { Pet, PetType } from "@/lib/types";

// PetCard needs no Supabase and no router. Rendered without a LanguageProvider
// the default t is the identity function, so every label below IS its
// translation key - which is what makes the "leaks a raw key" assertions exact.

function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: "p-1",
    owner_id: "u-1",
    name: "Rex",
    type: "dog",
    sex: "male",
    weight_kg: 12,
    bio: null,
    photo_url: null,
    created_at: "2026-09-01T10:00:00Z",
    ...over,
  } as Pet;
}

/** The lucide icon rendered in the fallback tile, identified by its class. */
function iconEl(container: HTMLElement): SVGElement {
  const el = container.querySelector("svg.w-7");
  if (!el) throw new Error("expected an icon in the fallback tile");
  return el as SVGElement;
}

/** The coloured tile that stands in for a missing photo. */
function tile(container: HTMLElement): HTMLElement {
  const el = container.querySelector(".w-16.h-16");
  if (!el) throw new Error("expected a photo slot");
  return el as HTMLElement;
}

const metaLine = (container: HTMLElement) =>
  container.querySelector("p")?.textContent ?? "";

describe("photo slot", () => {
  it("renders the pet photo when one is set", () => {
    const { container } = render(
      <PetCard pet={pet({ photo_url: "https://x/rex.jpg" })} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://x/rex.jpg");
    expect(img).toHaveAttribute("alt", "Rex");
  });

  it("lazy-loads the photo and withholds the referrer, as these are third-party URLs", () => {
    const { container } = render(
      <PetCard pet={pet({ photo_url: "https://x/rex.jpg" })} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("falls back to the icon tile when there is no photo", () => {
    const { container } = render(<PetCard pet={pet({ photo_url: null })} />);
    expect(container.querySelector("img")).toBeNull();
    expect(iconEl(container)).toBeInTheDocument();
  });

  it("treats an empty photo url as absent", () => {
    const { container } = render(<PetCard pet={pet({ photo_url: "" })} />);
    expect(container.querySelector("img")).toBeNull();
  });

  // There is no onError handler and no fallback chain here, unlike BookingCard,
  // which falls through pet photo -> counterparty avatar -> initials. A dead
  // link on a pet card shows the browser's broken-image glyph and nothing else.
  it("offers no recovery path for a photo url that fails to load", () => {
    const { container } = render(
      <PetCard pet={pet({ photo_url: "https://x/gone.jpg" })} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toHaveAttribute("onerror");
    expect(iconEl.bind(null, container)).toThrow(); // no tile is rendered alongside
  });
});

describe("species icon and colour", () => {
  it.each([
    ["dog", "bg-amber-50"],
    ["cat", "bg-violet-50"],
    ["bird", "bg-sky-50"],
    ["fish", "bg-blue-50"],
    ["reptile", "bg-green-50"],
    ["small_mammal", "bg-orange-50"],
    ["other", "bg-stone-100"],
  ] as const)("tints the tile for a %s", (type, bg) => {
    const { container } = render(<PetCard pet={pet({ type: type as PetType })} />);
    expect(tile(container)).toHaveClass(bg);
  });

  it("gives each species its own icon", () => {
    // Distinct species must not be visually interchangeable.
    const iconFor = (type: string) => {
      const view = render(<PetCard pet={pet({ type: type as PetType })} />);
      const cls = iconEl(view.container).getAttribute("class");
      view.unmount();
      return cls;
    };
    expect(iconFor("dog")).not.toBe(iconFor("cat"));
    expect(iconFor("bird")).not.toBe(iconFor("fish"));
  });

  // BUG (src/components/PetCard.tsx:9-11): PET_ICONS maps BOTH reptile and
  // small_mammal to the Squirrel glyph, so a snake, lizard or tortoise is shown
  // to its owner as a squirrel. The colour tints differ, which is the only
  // thing keeping the two apart. Correct behaviour would be a distinct glyph
  // for reptiles (lucide ships Turtle).
  it("draws a reptile with the same squirrel glyph as a small mammal (current buggy behaviour)", () => {
    const reptile = render(<PetCard pet={pet({ type: "reptile" })} />);
    const reptileIcon = iconEl(reptile.container).getAttribute("class");
    reptile.unmount();

    const mammal = render(<PetCard pet={pet({ type: "small_mammal" })} />);
    expect(iconEl(mammal.container).getAttribute("class")).toBe(reptileIcon);
  });

  it("falls back to a neutral tile for an unrecognised species", () => {
    const { container } = render(
      <PetCard pet={pet({ type: "horse" as PetType })} />,
    );
    expect(tile(container)).toHaveClass("bg-stone-100", "text-stone-500");
    expect(iconEl(container)).toBeInTheDocument();
  });

  it("leaks the raw translation key as the label for an unrecognised species", () => {
    // The icon degrades gracefully but the copy does not: the user sees the
    // dot-path itself where the species name should be.
    render(<PetCard pet={pet({ type: "horse" as PetType })} />);
    expect(screen.getByText(/common\.petTypes\.horse/)).toBeInTheDocument();
  });
});

describe("meta line", () => {
  it("composes species, sex and weight in order", () => {
    const { container } = render(
      <PetCard pet={pet({ type: "dog", sex: "male", weight_kg: 12 })} />,
    );
    expect(metaLine(container)).toBe(
      "common.petTypes.dog · common.petSex.male · 12appPages.petCard.weightUnit",
    );
  });

  it.each(["male", "female"] as const)("shows a known sex (%s)", (sex) => {
    const { container } = render(<PetCard pet={pet({ sex })} />);
    expect(metaLine(container)).toContain(`common.petSex.${sex}`);
  });

  it.each([
    ["unknown", "unknown"],
    ["null", null],
    ["an empty string", ""],
  ])("omits the sex segment when it is %s", (_label, sex) => {
    const { container } = render(
      <PetCard pet={pet({ sex: sex as Pet["sex"] })} />,
    );
    expect(metaLine(container)).not.toContain("common.petSex");
  });

  it("shows a fractional weight", () => {
    const { container } = render(<PetCard pet={pet({ weight_kg: 0.4 })} />);
    expect(metaLine(container)).toContain("0.4");
  });

  it("omits the weight segment when it is null", () => {
    const { container } = render(<PetCard pet={pet({ weight_kg: null })} />);
    expect(metaLine(container)).not.toContain("weightUnit");
  });

  // BUG (src/components/PetCard.tsx:77): the guard is `pet.weight_kg && ...`.
  // For a weight of 0 the && short-circuits to the NUMBER 0, not to false, and
  // React renders 0 as text. So instead of hiding the segment it emits a bare
  // "0" glued onto the sex with no separator and no unit: "· male0".
  // The pet form accepts 0 (step="0.1", no min), so this is reachable.
  // Correct behaviour would be `pet.weight_kg != null && ...`.
  it("appends a bare stray zero for a weight of zero (current buggy behaviour)", () => {
    const { container } = render(<PetCard pet={pet({ weight_kg: 0 })} />);
    const line = metaLine(container);
    expect(line).toBe("common.petTypes.dog · common.petSex.male0");
    // No separator and no unit came with it - just the digit.
    expect(line).not.toContain("weightUnit");
    expect(line).not.toContain("· 0");
  });
});

describe("bio", () => {
  it("renders the bio when present", () => {
    render(<PetCard pet={pet({ bio: "Loves long walks." })} />);
    expect(screen.getByText("Loves long walks.")).toBeInTheDocument();
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
  ])("omits the bio paragraph when it is %s", (_label, bio) => {
    const { container } = render(<PetCard pet={pet({ bio })} />);
    // Only the meta line remains.
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  // SitterCard clamps its equivalent copy with line-clamp-2. This one does not,
  // so a long bio grows the card without limit and breaks the grid rhythm.
  it("applies no line clamp to a long bio (current behaviour)", () => {
    const long = "A ".repeat(400);
    render(<PetCard pet={pet({ bio: long })} />);
    const paragraph = screen.getByText(long.trim());
    expect(paragraph.className).not.toContain("line-clamp");
  });

  it("applies no truncation to a long pet name either", () => {
    const name = "Bartholomew Maximilian the Third of Vilnius";
    render(<PetCard pet={pet({ name })} />);
    expect(screen.getByRole("heading", { name }).className).not.toContain("truncate");
  });
});

describe("actions", () => {
  it("renders no buttons when neither callback is supplied", () => {
    render(<PetCard pet={pet()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders a delete button that calls its callback", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<PetCard pet={pet()} onDelete={onDelete} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("renders an edit button that calls its callback", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<PetCard pet={pet()} onEdit={onEdit} />);

    await user.click(screen.getByRole("button"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("renders edit before delete when both are supplied", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<PetCard pet={pet()} onEdit={onEdit} onDelete={onDelete} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  // DEAD CODE: onEdit is supported here but no caller in the app supplies it -
  // src/app/(app)/pets/page.tsx passes only onDelete. The pencil button is
  // therefore unreachable in the shipped product, and there is no edit-pet
  // route to reach either. Pinned so the prop is either wired up or removed
  // deliberately rather than lingering as an untested branch.
  it("supports an edit affordance the app never actually renders", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<PetCard pet={pet()} onEdit={onEdit} />);
    await user.click(screen.getByRole("button"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("keeps the action row present but empty, reserving the layout slot", () => {
    // The flex container renders unconditionally; only its children are gated.
    const { container } = render(<PetCard pet={pet()} />);
    const row = container.querySelector(".flex.items-center.gap-2");
    expect(row).toBeInTheDocument();
    expect(row?.children).toHaveLength(0);
  });
});
