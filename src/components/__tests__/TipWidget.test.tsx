import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TipWidget, {
  loadSeenIds,
  saveSeenIds,
  personalizedOrder,
  pickStartIndex,
} from "@/components/TipWidget";
import TipCard from "@/components/TipCard";
import { TIPS, type Tip } from "@/lib/tips";
import { LanguageProvider } from "@/context/LanguageContext";

// LanguageProvider mirrors the locale to a profile row on mount, so the real
// Supabase client would be constructed and (worse) hit the setup's throwing
// fetch stub. Only the two calls the provider makes are needed here.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

// AnimatePresence has no `mode` set, so mid-crossfade the outgoing card is still
// mounted alongside the incoming one and every getByText for tip copy would blow
// up with "found multiple elements". Rendering children directly keeps exactly
// one card on screen, which is what every rotation assertion below depends on.
vi.mock("framer-motion", async (orig) => {
  const actual = await orig<typeof import("framer-motion")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

const SEEN_KEY = "petbnb-tips-seen";
const ID = TIPS.map((tip) => tip.id);

/** The tip currently on screen, identified by its rendered title key. */
function visibleTipId(): string | null {
  for (const tip of TIPS) {
    if (screen.queryByText(`tips.${tip.id}.title`)) return tip.id;
  }
  return null;
}

/** The progress dots, in DOM order. */
function dots(): HTMLElement[] {
  return screen.getAllByRole("button");
}

const isActive = (dot: HTMLElement) =>
  dot.classList.contains("w-4") && dot.classList.contains("bg-brand");

const seenLog = (): unknown =>
  JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "null");

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// personalizedOrder — pure, and the highest-value target in the file
// ---------------------------------------------------------------------------

describe("personalizedOrder", () => {
  it("floats Cats tips to the front for a cat owner, preserving original order after", () => {
    const out = personalizedOrder([{ type: "cat" }], []);
    expect(out[0].id).toBe("cat-routine");
    expect(out.slice(1).map((tip) => tip.id)).toEqual(
      ID.filter((id) => id !== "cat-routine"),
    );
  });

  it("floats every matching tag to the front when several services are booked", () => {
    const out = personalizedOrder([{ type: "cat" }], ["walking", "boarding"]);
    // Matching group keeps TIPS order among itself: Walking, Boarding, Cats.
    expect(out.slice(0, 3).map((tip) => tip.id)).toEqual([
      "midday-heat",
      "pack-familiar",
      "cat-routine",
    ]);
  });

  // BUG (src/components/TipWidget.tsx:11-18): SERVICE_TAG has no "daycare" entry
  // and PET_TAG has no "dog" entry, so the single most common PetBnB customer —
  // a dog owner with a daycare booking — gets no personalisation at all and sees
  // the untouched default list. Correct behaviour would be to map daycare to a
  // "Daycare"/"Settling in" tag and dog to a "Walking"/"Play" tag. Pinned so the
  // fix has a failing test to flip.
  it("gives a dog owner with a daycare booking zero personalisation (current gap)", () => {
    const out = personalizedOrder([{ type: "dog" }], ["daycare"]);
    expect(out.map((tip) => tip.id)).toEqual(ID);
  });

  // BUG (src/components/TipWidget.tsx:47): the no-tags path returns the module
  // constant TIPS itself, not a copy. Any caller that sorts or splices the
  // "personalised" order in place would permanently corrupt TIPS for the whole
  // session. Correct behaviour would be `return [...TIPS]`.
  it("returns the TIPS module constant by reference when nothing matches (current buggy behaviour)", () => {
    expect(personalizedOrder([{ type: "dog" }], ["daycare"])).toBe(TIPS);
    expect(personalizedOrder([], [])).toBe(TIPS);
  });

  it("returns a fresh array — not the TIPS constant — whenever a tag matched", () => {
    const out = personalizedOrder([{ type: "cat" }], []);
    expect(out).not.toBe(TIPS);
  });

  // BUG (src/components/TipWidget.tsx:41-46): the lookups are plain index reads
  // on object literals, so inherited Object.prototype members answer. A pet type
  // of "constructor" resolves to the Object constructor, the `if (tag)` guard
  // passes, and a *function* is added to the tag Set. Nothing then matches
  // tip.tag, so the user still sees the default order — but the reference-return
  // shortcut is skipped, proving the poisoned tag got in. Correct behaviour would
  // be Object.hasOwn(PET_TAG, pet.type) or a null-prototype map.
  it("adds a function to the tag set for a pet type of 'constructor' (current buggy behaviour)", () => {
    const out = personalizedOrder([{ type: "constructor" }], []);
    expect(out).not.toBe(TIPS); // tags.size was 1, so the empty-tags shortcut was skipped
    expect(out.map((tip) => tip.id)).toEqual(ID); // ...yet nothing actually matched
  });

  it("adds a function to the tag set for a service of 'toString' (current buggy behaviour)", () => {
    const out = personalizedOrder([], ["toString"]);
    expect(out).not.toBe(TIPS);
    expect(out.map((tip) => tip.id)).toEqual(ID);
  });

  it("still personalises normally when a poisoned key sits alongside a real one", () => {
    const out = personalizedOrder([{ type: "constructor" }, { type: "cat" }], []);
    expect(out[0].id).toBe("cat-routine");
    expect(out).toHaveLength(TIPS.length);
  });

  it.each([
    ["no input", [] as { type: string }[], [] as string[]],
    ["one pet tag", [{ type: "cat" }], []],
    ["one service tag", [], ["grooming"]],
    ["every mapped tag", [{ type: "cat" }], ["walking", "boarding", "grooming"]],
    ["unmapped keys only", [{ type: "fish" }], ["daycare"]],
    ["duplicate services", [{ type: "cat" }, { type: "cat" }], ["walking", "walking"]],
  ])("is always a permutation of TIPS: %s", (_label, pets, services) => {
    const out = personalizedOrder(pets, services);
    expect(out).toHaveLength(TIPS.length);
    expect(new Set(out.map((tip) => tip.id)).size).toBe(TIPS.length);
    expect([...out].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...TIPS].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("keeps the original relative order inside both the matching and the rest group", () => {
    const out = personalizedOrder([{ type: "cat" }], ["grooming"]);
    const matching = out.filter((tip) => tip.tag === "Cats" || tip.tag === "Grooming");
    const rest = out.filter((tip) => tip.tag !== "Cats" && tip.tag !== "Grooming");
    // Every matching tip precedes every other tip...
    expect(out.slice(0, matching.length)).toEqual(matching);
    // ...and within each group the TIPS index sequence is still ascending.
    const indexes = (group: Tip[]) => group.map((tip) => TIPS.indexOf(tip));
    expect(indexes(matching)).toEqual([...indexes(matching)].sort((a, b) => a - b));
    expect(indexes(rest)).toEqual([...indexes(rest)].sort((a, b) => a - b));
  });
});

// ---------------------------------------------------------------------------
// loadSeenIds / saveSeenIds
// ---------------------------------------------------------------------------

describe("loadSeenIds", () => {
  it("returns an empty array when the key was never written", () => {
    expect(loadSeenIds()).toEqual([]);
  });

  it("returns the stored ids round-tripped through saveSeenIds", () => {
    saveSeenIds(["midday-heat", "cat-routine"]);
    expect(loadSeenIds()).toEqual(["midday-heat", "cat-routine"]);
  });

  it("returns an empty array for corrupt JSON rather than throwing", () => {
    window.localStorage.setItem(SEEN_KEY, "{not json");
    expect(loadSeenIds()).toEqual([]);
  });

  it("returns an empty array when the stored JSON is an object, not an array", () => {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ "midday-heat": true }));
    expect(loadSeenIds()).toEqual([]);
  });

  it("returns an empty array for the JSON literal null", () => {
    // `raw` is the truthy string "null", so JSON.parse runs and yields null;
    // the Array.isArray guard is what saves this case, not the `raw ?` check.
    window.localStorage.setItem(SEEN_KEY, "null");
    expect(loadSeenIds()).toEqual([]);
  });

  it("returns an empty array for an empty string, which is falsy and skips JSON.parse", () => {
    window.localStorage.setItem(SEEN_KEY, "");
    expect(loadSeenIds()).toEqual([]);
  });

  it("returns an empty array when localStorage throws (private browsing)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadSeenIds()).toEqual([]);
  });

  // BUG (src/components/TipWidget.tsx:22-25): the array branch is not element-
  // checked, so a log of numbers is returned as if it were string ids. Every
  // later `seen.includes(tip.id)` compares "midday-heat" against 0 and fails, so
  // the first tip is re-marked as seen forever and the rotation never advances
  // its start point. Correct behaviour would be to filter to strings.
  it("passes an array of numbers straight through, so the id check can never match (current buggy behaviour)", () => {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([0, 1, 2]));
    expect(loadSeenIds()).toEqual([0, 1, 2]);

    // Observable consequence: index 0 is picked again even though "everything"
    // is nominally logged, and the log just keeps growing.
    expect(pickStartIndex(TIPS)).toBe(0);
    expect(seenLog()).toEqual([0, 1, 2, "midday-heat"]);
  });
});

describe("saveSeenIds", () => {
  it("writes the ids as JSON under the seen key", () => {
    saveSeenIds(["a", "b"]);
    expect(window.localStorage.getItem(SEEN_KEY)).toBe('["a","b"]');
  });

  it("swallows a throwing localStorage instead of breaking the render", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveSeenIds(["a"])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// pickStartIndex
// ---------------------------------------------------------------------------

describe("pickStartIndex", () => {
  it("returns 0 and logs the first tip on a fresh browser", () => {
    expect(pickStartIndex(TIPS)).toBe(0);
    expect(seenLog()).toEqual([ID[0]]);
  });

  it("skips to the first unseen tip when the earlier ones were already shown", () => {
    saveSeenIds(ID.slice(0, 4));
    expect(pickStartIndex(TIPS)).toBe(4);
    expect(seenLog()).toEqual([...ID.slice(0, 4), ID[4]]);
  });

  it("finds a single unseen tip in the middle of an otherwise full log", () => {
    const seen = ID.filter((id) => id !== ID[5]);
    saveSeenIds(seen);
    expect(pickStartIndex(TIPS)).toBe(5);
    expect(seenLog()).toEqual([...seen, ID[5]]);
  });

  it("resets the log to just the first id once all ten tips have been seen", () => {
    saveSeenIds(ID);
    expect(loadSeenIds()).toHaveLength(10);
    expect(pickStartIndex(TIPS)).toBe(0);
    // The reset happens in memory, then only the freshly shown id is persisted,
    // so a ten-entry log shrinks to one.
    expect(seenLog()).toEqual([ID[0]]);
  });

  it("ignores stale ids that are no longer in TIPS but keeps them in the log", () => {
    saveSeenIds(["retired-tip", "another-gone-one"]);
    expect(pickStartIndex(TIPS)).toBe(0);
    expect(seenLog()).toEqual(["retired-tip", "another-gone-one", ID[0]]);
  });

  it("does not re-append an id that is already logged", () => {
    saveSeenIds(["retired-tip", ID[0]]);
    // ID[0] is seen, so index 1 is picked and appended once.
    expect(pickStartIndex(TIPS)).toBe(1);
    expect(seenLog()).toEqual(["retired-tip", ID[0], ID[1]]);
  });

  it("returns 0 and writes nothing for an empty order", () => {
    saveSeenIds(["retired-tip"]);
    expect(pickStartIndex([])).toBe(0);
    // findIndex is -1, the in-memory log is cleared, but order[0] is undefined
    // so nothing is saved and the stored log is left exactly as it was.
    expect(seenLog()).toEqual(["retired-tip"]);
  });

  it("respects the personalised order, not the TIPS order, when choosing", () => {
    const order = personalizedOrder([{ type: "cat" }], []);
    saveSeenIds(["cat-routine"]);
    expect(pickStartIndex(order)).toBe(1);
    expect(order[1].id).toBe(ID[0]);
  });
});

// ---------------------------------------------------------------------------
// TipCard
// ---------------------------------------------------------------------------

describe("TipCard", () => {
  const tip = TIPS[0];

  it("renders only dictionary keys derived from the tip id, never the tip's own English copy", () => {
    render(<TipCard tip={tip} />);
    // Default context t is the identity function, so each key IS the rendered text.
    expect(screen.getByText(`tips.${tip.id}.tag`)).toBeInTheDocument();
    expect(screen.getByText(`tips.${tip.id}.title`)).toBeInTheDocument();
    expect(screen.getByText(`tips.${tip.id}.body`)).toBeInTheDocument();
    // The tag/title/body fields on the Tip object are dead weight — never shown.
    expect(screen.queryByText(tip.title)).not.toBeInTheDocument();
    expect(screen.queryByText(tip.body)).not.toBeInTheDocument();
  });

  it("renders the tip image with an empty alt, since the copy carries the meaning", () => {
    const { container } = render(<TipCard tip={tip} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", tip.image);
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("renders the translated copy when wrapped in a real LanguageProvider", () => {
    render(
      <LanguageProvider>
        <TipCard tip={tip} />
      </LanguageProvider>,
    );
    expect(screen.getByText("Beat the midday heat")).toBeInTheDocument();
    expect(screen.getByText("Walking")).toBeInTheDocument();
  });

  it("renders three raw dot-path keys for a tip id missing from the dictionary", () => {
    const orphan: Tip = { ...tip, id: "not-in-dictionary" };
    render(
      <LanguageProvider>
        <TipCard tip={orphan} />
      </LanguageProvider>,
    );
    expect(screen.getByText("tips.not-in-dictionary.tag")).toBeInTheDocument();
    expect(screen.getByText("tips.not-in-dictionary.title")).toBeInTheDocument();
    expect(screen.getByText("tips.not-in-dictionary.body")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TipWidget — personalisation effect
// ---------------------------------------------------------------------------

describe("TipWidget personalisation", () => {
  it("shows the first TIP and touches no localStorage when no props are passed", () => {
    render(<TipWidget />);
    expect(visibleTipId()).toBe(ID[0]);
    expect(window.localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it("opens on the matching tip for a cat owner and logs it as seen", () => {
    render(<TipWidget pets={[{ type: "cat" }]} />);
    expect(visibleTipId()).toBe("cat-routine");
    expect(seenLog()).toEqual(["cat-routine"]);
  });

  it("opens on the next unseen personalised tip when the first was already shown", () => {
    saveSeenIds(["cat-routine"]);
    render(<TipWidget pets={[{ type: "cat" }]} />);
    expect(visibleTipId()).toBe(ID[0]);
  });

  it("falls back to the untouched default list when the props clear out", () => {
    saveSeenIds(["cat-routine", ID[0]]);
    const { rerender } = render(<TipWidget pets={[{ type: "cat" }]} />);
    expect(visibleTipId()).toBe(ID[1]);
    rerender(<TipWidget pets={[]} />);
    expect(visibleTipId()).toBe(ID[0]);
  });

  // BUG (src/components/TipWidget.tsx:83): the effect key joins pet types with
  // "," and services with ",", separated by "|", so distinct inputs collapse to
  // the same string. One pet of type "cat,x" and two pets of types "cat" and "x"
  // both key as "cat,x|" — the effect does not re-run and the user keeps the old,
  // wrong order after their pet list actually changed. Correct behaviour would be
  // to JSON.stringify the inputs (or use a separator that cannot occur in a type).
  it("does not re-personalise when two different pet lists collide on the key (current buggy behaviour)", () => {
    const { rerender } = render(<TipWidget pets={[{ type: "cat,x" }]} />);
    // "cat,x" is not in PET_TAG, so this is the unpersonalised order.
    expect(visibleTipId()).toBe(ID[0]);

    rerender(<TipWidget pets={[{ type: "cat" }, { type: "x" }]} />);
    // Should now open on "cat-routine"; the key is byte-identical, so it doesn't.
    expect(visibleTipId()).toBe(ID[0]);
  });

  it("re-personalises when the key genuinely changes (control for the collision above)", () => {
    const { rerender } = render(<TipWidget pets={[{ type: "x" }]} />);
    expect(visibleTipId()).toBe(ID[0]);
    rerender(<TipWidget pets={[{ type: "cat" }]} />);
    expect(visibleTipId()).toBe("cat-routine");
  });

  it("does not re-run for a new array instance holding the same pet types", () => {
    saveSeenIds([ID[0]]);
    const { rerender } = render(<TipWidget pets={[{ type: "x" }]} />);
    expect(visibleTipId()).toBe(ID[1]);
    // A fresh array each render is exactly what an async dashboard fetch produces;
    // the string key is what stops it from re-picking (and re-logging) every time.
    rerender(<TipWidget pets={[{ type: "x" }]} />);
    expect(visibleTipId()).toBe(ID[1]);
    expect(seenLog()).toEqual([ID[0], ID[1]]);
  });
});

// ---------------------------------------------------------------------------
// TipWidget — rotation
// ---------------------------------------------------------------------------

describe("TipWidget rotation", () => {
  it("advances to the next tip after the default 7s interval and wraps at the end", () => {
    vi.useFakeTimers();
    render(<TipWidget />);
    expect(visibleTipId()).toBe(ID[0]);

    act(() => void vi.advanceTimersByTime(7000));
    expect(visibleTipId()).toBe(ID[1]);

    act(() => void vi.advanceTimersByTime(7000 * (TIPS.length - 1)));
    expect(visibleTipId()).toBe(ID[0]);
  });

  it("does not advance a millisecond before the interval elapses", () => {
    vi.useFakeTimers();
    render(<TipWidget intervalMs={1000} />);
    act(() => void vi.advanceTimersByTime(999));
    expect(visibleTipId()).toBe(ID[0]);
    act(() => void vi.advanceTimersByTime(1));
    expect(visibleTipId()).toBe(ID[1]);
  });

  it("pauses on hover and resumes on unhover", () => {
    // fireEvent rather than userEvent.hover here: the component listens for
    // plain onMouseEnter/onMouseLeave, and userEvent's full pointer simulation
    // deadlocks against fake timers, which is what made this test time out.
    // The observable behaviour - does the tip advance? - is what is asserted,
    // rather than a raw timer count, because framer-motion schedules timers of
    // its own and the absolute count is not this component's contract.
    vi.useFakeTimers();
    const { container } = render(<TipWidget intervalMs={1000} />);
    const root = container.firstElementChild as HTMLElement;

    act(() => void fireEvent.mouseEnter(root));
    act(() => void vi.advanceTimersByTime(10_000));
    expect(visibleTipId()).toBe(ID[0]); // frozen while hovered

    act(() => void fireEvent.mouseLeave(root));
    act(() => void vi.advanceTimersByTime(1000));
    expect(visibleTipId()).toBe(ID[1]); // rotating again
  });

  it("clears its rotation interval on unmount", () => {
    // Spying on the pair, rather than counting pending timers: framer-motion
    // keeps timers of its own that do not settle synchronously on unmount, so
    // a global count is not this component's contract. Asserting that the id
    // it created is the id it clears is exact and immune to that noise.
    vi.useFakeTimers();
    const setSpy = vi.spyOn(globalThis, "setInterval");
    const clearSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = render(<TipWidget intervalMs={1000} />);
    const intervalId = setSpy.mock.results.at(-1)?.value;
    expect(intervalId).toBeDefined();
    expect(clearSpy).not.toHaveBeenCalledWith(intervalId);

    unmount();
    expect(clearSpy).toHaveBeenCalledWith(intervalId);
  });

  it("restarts the interval when intervalMs changes", () => {
    vi.useFakeTimers();
    const { rerender } = render(<TipWidget intervalMs={5000} />);
    act(() => void vi.advanceTimersByTime(4000));
    rerender(<TipWidget intervalMs={1000} />);
    // The old timer was cleared, so the elapsed 4000ms is discarded.
    act(() => void vi.advanceTimersByTime(999));
    expect(visibleTipId()).toBe(ID[0]);
    act(() => void vi.advanceTimersByTime(1));
    expect(visibleTipId()).toBe(ID[1]);
  });

  // BUG (src/components/TipWidget.tsx:102): intervalMs is handed to setInterval
  // with no validation. Any value below ~4ms makes the widget flip tips faster
  // than a reader can follow - a strobing card - and a negative value is clamped
  // to 0 by the platform rather than pausing or throwing. Correct behaviour
  // would be to clamp to a sane minimum, or to skip the interval for <= 0.
  //
  // These assert on the scheduling call rather than letting the timer fire: a
  // 0ms interval re-arms itself at the same instant, so advancing fake time by
  // any amount never terminates, and restoring real timers with one still
  // pending spins the event loop hard enough to kill the worker process.
  it.each([
    ["zero", 0],
    ["negative", -1000],
  ])("passes a %s intervalMs straight through to setInterval (current buggy behaviour)", (_label, intervalMs) => {
    vi.useFakeTimers();
    const setSpy = vi.spyOn(globalThis, "setInterval");
    const { unmount } = render(<TipWidget intervalMs={intervalMs} />);

    expect(setSpy).toHaveBeenCalledWith(expect.any(Function), intervalMs);
    unmount();
  });

});

// ---------------------------------------------------------------------------
// TipWidget — progress dots
// ---------------------------------------------------------------------------

describe("TipWidget dots", () => {
  it("renders one dot per tip with exactly one marked active", () => {
    render(<TipWidget />);
    expect(dots()).toHaveLength(TIPS.length);
    expect(dots().filter(isActive)).toHaveLength(1);
    expect(isActive(dots()[0])).toBe(true);
  });

  it("labels the dots with a one-based index", () => {
    render(
      <LanguageProvider>
        <TipWidget />
      </LanguageProvider>,
    );
    expect(screen.getByRole("button", { name: "Tip 1" })).toBe(dots()[0]);
    expect(screen.getByRole("button", { name: `Tip ${TIPS.length}` })).toBe(
      dots()[TIPS.length - 1],
    );
    expect(screen.queryByRole("button", { name: "Tip 0" })).not.toBeInTheDocument();
  });

  it("jumps to the clicked tip and moves the active marker with it", async () => {
    const user = userEvent.setup();
    render(<TipWidget />);
    await user.click(dots()[4]);
    expect(visibleTipId()).toBe(ID[4]);
    expect(dots().filter(isActive)).toHaveLength(1);
    expect(isActive(dots()[4])).toBe(true);
    expect(isActive(dots()[0])).toBe(false);
  });

  it("keeps the dots aligned with the personalised order, not the TIPS order", async () => {
    const user = userEvent.setup();
    render(<TipWidget pets={[{ type: "cat" }]} />);
    await user.click(dots()[1]);
    // Index 1 of the personalised order is the first non-matching tip.
    expect(visibleTipId()).toBe(ID[0]);
  });

  it("restarts the rotation clock from the clicked tip", () => {
    // fireEvent, not userEvent: userEvent's async click sequence advances the
    // fake clock while a rotation interval is live, which re-enters render
    // mid-gesture and deadlocks the worker. A plain click is what the dot
    // actually listens for.
    vi.useFakeTimers();
    render(<TipWidget intervalMs={1000} />);
    act(() => void fireEvent.click(dots()[7]));
    expect(visibleTipId()).toBe(ID[7]);
    act(() => void vi.advanceTimersByTime(1000));
    expect(visibleTipId()).toBe(ID[8]);
  });
});
