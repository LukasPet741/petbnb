import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FavoriteButton from "@/components/FavoriteButton";
import { FavoritesProvider } from "@/context/FavoritesContext";

// FavoriteButton reads two contexts: useLanguage (rendered without a
// LanguageProvider, its default t is the identity function, so every label
// below IS the translation key the component asked for) and useFavorites.
//
// The state matrix below drives useFavorites through a hoisted override so the
// active/inactive rendering is asserted on real DOM. The toggle-semantics
// blocks at the bottom drop the override and use the REAL FavoritesProvider,
// because "logged out is a silent no-op" and "a double click inserts twice"
// are behaviours of the provider's toggle, not of a stub.

type FavoritesValue = ReturnType<typeof import("@/context/FavoritesContext").useFavorites>;

const h = vi.hoisted(() => ({
  /** null => fall through to the real FavoritesProvider/default context. */
  favorites: null as Partial<FavoritesValue> | null,
  user: null as { id: string } | null,
  inserted: [] as unknown[],
  deleted: [] as Record<string, string>[],
}));

vi.mock("@/context/FavoritesContext", async (orig) => {
  const actual = await orig<typeof import("@/context/FavoritesContext")>();
  return {
    ...actual,
    useFavorites: () => {
      const real = actual.useFavorites();
      return h.favorites ? { ...real, ...h.favorites } : real;
    },
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: h.user, session: null, loading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/supabase", () => {
  const eqFilters: Record<string, string> = {};
  const chain = {
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn((col: string, val: string) => {
      eqFilters[col] = val;
      return chain;
    }),
    insert: vi.fn(async (row: unknown) => {
      h.inserted.push(row);
      return { data: null, error: null };
    }),
    delete: vi.fn(() => {
      // The delete()'s eq() filters land in eqFilters; snapshot them when the
      // awaited chain settles.
      return {
        eq: (col: string, val: string) => ({
          eq: (col2: string, val2: string) => {
            h.deleted.push({ [col]: val, [col2]: val2 });
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    }),
    // The provider's initial load awaits the select chain directly.
    then: (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: [] }),
  };
  return { supabase: chain };
});

const REMOVE_KEY = "appPages.favoriteButton.removeFromSaved";
const SAVE_KEY = "appPages.favoriteButton.saveSitter";

/** The lucide Heart svg inside the button. */
function heart(container: HTMLElement): SVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("expected a heart icon");
  return svg;
}

beforeEach(() => {
  h.favorites = null;
  h.user = null;
  h.inserted = [];
  h.deleted = [];
});

describe("saved / not-saved states", () => {
  it("renders the save-sitter label on both aria-label and title when the sitter is not saved", () => {
    h.favorites = { isFavorite: () => false, toggle: vi.fn() };
    render(<FavoriteButton sitterId="s-1" />);

    const btn = screen.getByRole("button", { name: SAVE_KEY });
    // Icon-only control: the accessible name and the hover tooltip must agree.
    expect(btn).toHaveAttribute("title", SAVE_KEY);
  });

  it("renders the remove-from-saved label on both aria-label and title when the sitter is saved", () => {
    h.favorites = { isFavorite: () => true, toggle: vi.fn() };
    render(<FavoriteButton sitterId="s-1" />);

    const btn = screen.getByRole("button", { name: REMOVE_KEY });
    expect(btn).toHaveAttribute("title", REMOVE_KEY);
  });

  it("uses the muted surface treatment and an unfilled heart when not saved", () => {
    h.favorites = { isFavorite: () => false, toggle: vi.fn() };
    const { container } = render(<FavoriteButton sitterId="s-1" />);

    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-surface-2", "text-ink-soft", "hover:text-rose-500");
    expect(btn).not.toHaveClass("bg-rose-50");
    expect(heart(container)).not.toHaveClass("fill-rose-500");
  });

  it("uses the rose treatment and a filled heart when saved", () => {
    h.favorites = { isFavorite: () => true, toggle: vi.fn() };
    const { container } = render(<FavoriteButton sitterId="s-1" />);

    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-rose-50", "text-rose-500");
    expect(btn).not.toHaveClass("bg-surface-2");
    expect(heart(container)).toHaveClass("fill-rose-500");
  });

  it("asks the favourites context about its own sitter id, not another card's", () => {
    const isFavorite = vi.fn((id: string) => id === "s-saved");
    h.favorites = { isFavorite, toggle: vi.fn() };

    const { container } = render(
      <>
        <FavoriteButton sitterId="s-saved" />
        <FavoriteButton sitterId="s-other" />
      </>,
    );

    const [savedBtn, otherBtn] = screen.getAllByRole("button");
    expect(savedBtn).toHaveAccessibleName(REMOVE_KEY);
    expect(otherBtn).toHaveAccessibleName(SAVE_KEY);
    const hearts = container.querySelectorAll("svg");
    expect(hearts[0]).toHaveClass("fill-rose-500");
    expect(hearts[1]).not.toHaveClass("fill-rose-500");
  });

  it("is always type=button so it never submits a surrounding form", () => {
    h.favorites = { isFavorite: () => false, toggle: vi.fn() };
    render(<FavoriteButton sitterId="s-1" />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("nested inside a card-wide link", () => {
  // SitterCard wraps its whole body in a <Link>, with this button on top of it.
  // Without stopPropagation the click would bubble to the card and navigate to
  // the sitter's page; without preventDefault the anchor's default activation
  // would do the same.

  it("does not trigger the surrounding anchor's click handler", async () => {
    const toggle = vi.fn();
    h.favorites = { isFavorite: () => false, toggle };
    const onAnchorClick = vi.fn();

    render(
      // eslint-disable-next-line jsx-a11y/anchor-is-valid
      <a href="/sitters/s-1" onClick={onAnchorClick}>
        <span>Jonas Petraitis</span>
        <FavoriteButton sitterId="s-1" />
      </a>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onAnchorClick).not.toHaveBeenCalled();
    expect(toggle).toHaveBeenCalledWith("s-1");
  });

  it("still lets a click on the rest of the card reach the anchor", async () => {
    h.favorites = { isFavorite: () => false, toggle: vi.fn() };
    const onAnchorClick = vi.fn((e: React.MouseEvent) => e.preventDefault());

    render(
      <a href="/sitters/s-1" onClick={onAnchorClick}>
        <span>Jonas Petraitis</span>
        <FavoriteButton sitterId="s-1" />
      </a>,
    );

    await userEvent.click(screen.getByText("Jonas Petraitis"));
    expect(onAnchorClick).toHaveBeenCalledTimes(1);
  });

  it("cancels the click's default action so the anchor never navigates", () => {
    h.favorites = { isFavorite: () => false, toggle: vi.fn() };
    render(
      <a href="/sitters/s-1">
        <FavoriteButton sitterId="s-1" />
      </a>,
    );

    const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      screen.getByRole("button").dispatchEvent(evt);
    });

    expect(evt.defaultPrevented).toBe(true);
  });
});

describe("toggle semantics through the real FavoritesProvider", () => {
  function renderInProvider(sitterId = "s-1") {
    return render(
      <FavoritesProvider>
        <FavoriteButton sitterId={sitterId} />
      </FavoritesProvider>,
    );
  }

  it("is a completely silent no-op when nobody is logged in", async () => {
    h.user = null;
    const { container } = renderInProvider();

    const btn = screen.getByRole("button");
    const before = btn.className;

    await userEvent.click(btn);

    // No sign-in prompt, no toast, no aria-live region, no disabled state, no
    // change of any kind: the provider's toggle returns early for an anonymous
    // visitor. Correct behaviour would be to route to sign-in or explain why
    // nothing happened; pinned here so a fix has a failing test to flip.
    expect(btn).toHaveAccessibleName(SAVE_KEY);
    expect(btn.className).toBe(before);
    expect(heart(container)).not.toHaveClass("fill-rose-500");
    expect(container.textContent).toBe("");
    expect(h.inserted).toEqual([]);
    expect(h.deleted).toEqual([]);
  });

  it("flips to saved and writes the row when a signed-in user clicks it", async () => {
    h.user = { id: "u-1" };
    const { container } = renderInProvider("s-9");

    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveAccessibleName(REMOVE_KEY);
    expect(heart(container)).toHaveClass("fill-rose-500");
    expect(h.inserted).toEqual([{ sitter_id: "s-9" }]);
  });

  it("flips back to unsaved and deletes the row on a second, separate click", async () => {
    h.user = { id: "u-1" };
    const { container } = renderInProvider("s-9");
    const btn = screen.getByRole("button");

    await userEvent.click(btn);
    await userEvent.click(btn);

    expect(btn).toHaveAccessibleName(SAVE_KEY);
    expect(heart(container)).not.toHaveClass("fill-rose-500");
    expect(h.deleted).toEqual([{ user_id: "u-1", sitter_id: "s-9" }]);
  });

  // BUG: toggle() is async and the click handler never awaits it, and the
  // button carries no disabled/aria-busy/pending state while it is in flight.
  // Two clicks landing in the same React batch both read the same `favorites`
  // snapshot, both compute has === false, and both fire an insert - so an
  // impatient double-click writes the favourite row twice while the UI shows a
  // single saved heart. Correct behaviour would be to disable the button (or
  // guard on an in-flight ref) until the write settles, and to upsert rather
  // than insert. Pinned as-is.
  it("fires two inserts for one saved heart when double-clicked in the same tick (current buggy behaviour)", () => {
    h.user = { id: "u-1" };
    const { container } = renderInProvider("s-9");
    const btn = screen.getByRole("button");

    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(btn).toHaveAccessibleName(REMOVE_KEY);
    expect(heart(container)).toHaveClass("fill-rose-500");
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute("aria-busy");
    expect(h.inserted).toEqual([{ sitter_id: "s-9" }, { sitter_id: "s-9" }]);
    expect(h.deleted).toEqual([]);
  });
});

describe("className merging", () => {
  it("lets a caller's smaller width and height win over the base w-9 h-9", () => {
    h.favorites = { isFavorite: () => false, toggle: vi.fn() };
    render(<FavoriteButton sitterId="s-1" className="w-7 h-7" />);

    const btn = screen.getByRole("button");
    // twMerge drops the conflicting base sizes rather than emitting both.
    expect(btn).toHaveClass("w-7", "h-7");
    expect(btn).not.toHaveClass("w-9");
    expect(btn).not.toHaveClass("h-9");
  });

  it("lets a caller's background win over the state background", () => {
    h.favorites = { isFavorite: () => true, toggle: vi.fn() };
    render(<FavoriteButton sitterId="s-1" className="bg-white" />);

    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-white");
    expect(btn).not.toHaveClass("bg-rose-50");
    // Non-conflicting base utilities survive the merge.
    expect(btn).toHaveClass("rounded-full", "flex-shrink-0", "text-rose-500");
  });

  it("keeps every base class when no className is passed", () => {
    h.favorites = { isFavorite: () => false, toggle: vi.fn() };
    render(<FavoriteButton sitterId="s-1" />);

    expect(screen.getByRole("button")).toHaveClass(
      "w-9",
      "h-9",
      "rounded-full",
      "flex",
      "items-center",
      "justify-center",
      "transition-colors",
      "flex-shrink-0",
    );
  });
});
