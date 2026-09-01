import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FavoritesProvider, useFavorites } from "@/context/FavoritesContext";

// ---------------------------------------------------------------------------
// Mocks. The provider talks to Supabase directly and reads the auth context,
// so both are stubbed. The Supabase stub is a thenable query builder, matching
// the real client's shape: .from().select().eq() is awaited directly, while
// .delete() and .insert() terminate their own chains.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  selectResult: { data: [] as { sitter_id: string }[] | null, error: null as unknown },
  mutationResult: { data: null as unknown, error: null as unknown },
  calls: [] as Array<{ op: string; args: unknown[] }>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: h.user, session: null, loading: false }),
}));

vi.mock("@/lib/supabase", () => {
  const record = (op: string, ...args: unknown[]) => h.calls.push({ op, args });

  const selectChain = () => {
    const chain = {
      eq: (...args: unknown[]) => {
        record("select.eq", ...args);
        return chain;
      },
      // The provider awaits the select chain directly, so it must be thenable.
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(h.selectResult).then(resolve),
    };
    return chain;
  };

  const mutationChain = (op: string) => {
    const chain = {
      eq: (...args: unknown[]) => {
        record(`${op}.eq`, ...args);
        return chain;
      },
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(h.mutationResult).then(resolve),
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => {
        record("from", table);
        return {
          select: (...args: unknown[]) => {
            record("select", ...args);
            return selectChain();
          },
          delete: () => {
            record("delete");
            return mutationChain("delete");
          },
          insert: (...args: unknown[]) => {
            record("insert", ...args);
            return mutationChain("insert");
          },
        };
      },
    },
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <FavoritesProvider>{children}</FavoritesProvider>
);

const rows = (...ids: (string | null)[]) => ids.map((sitter_id) => ({ sitter_id: sitter_id as string }));

/** Exact op match: "delete" must not also count the "delete.eq" links. */
const opsMatching = (op: string) => h.calls.filter((c) => c.op === op);

beforeEach(() => {
  h.user = { id: "u-1" };
  h.selectResult = { data: [], error: null };
  h.mutationResult = { data: null, error: null };
  h.calls = [];
});

async function mount(initial: (string | null)[] = []) {
  h.selectResult = { data: rows(...initial), error: null };
  const view = renderHook(() => useFavorites(), { wrapper });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe("loading", () => {
  it("starts in a loading state with nothing favourited", () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.count).toBe(0);
  });

  it("loads the signed-in user's saved sitter ids", async () => {
    const { result } = await mount(["s-1", "s-2"]);
    expect(result.current.favorites).toEqual(new Set(["s-1", "s-2"]));
    expect(result.current.count).toBe(2);
    expect(result.current.isFavorite("s-1")).toBe(true);
    expect(result.current.isFavorite("s-9")).toBe(false);
  });

  it("queries only the current user's rows", async () => {
    await mount(["s-1"]);
    expect(h.calls).toContainEqual({ op: "from", args: ["favorites"] });
    expect(h.calls).toContainEqual({ op: "select", args: ["sitter_id"] });
    expect(h.calls).toContainEqual({ op: "select.eq", args: ["user_id", "u-1"] });
  });

  it("treats a null data payload as an empty set", async () => {
    h.selectResult = { data: null, error: null };
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(0);
  });

  it("counts distinct sitters, not rows, when the table holds duplicates", async () => {
    // A missing unique constraint would show up here: the Set collapses them,
    // so the saved-count badge stays honest even with duplicate rows.
    const { result } = await mount(["s-1", "s-1", "s-2"]);
    expect(result.current.count).toBe(2);
  });

  it("keeps a null sitter_id in the set rather than filtering it out", async () => {
    // Pinning current behaviour: there is no guard, so a null foreign key
    // becomes a null set member. isFavorite() never matches it, so it is dead
    // weight in the count.
    const { result } = await mount([null]);
    expect(result.current.count).toBe(1);
    expect(result.current.favorites.has(null as unknown as string)).toBe(true);
  });

  it("reports nothing favourited and stops loading when signed out", async () => {
    h.user = null;
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(0);
    expect(opsMatching("select")).toHaveLength(0);
  });

  it("clears the set on logout, so favourites never leak between accounts", async () => {
    const { result, rerender } = await mount(["s-1", "s-2"]);
    expect(result.current.count).toBe(2);

    h.user = null;
    rerender();

    await waitFor(() => expect(result.current.count).toBe(0));
    // Contrast with useProfile, which leaves a stale profile in place on logout.
  });

  it("reports a sitter as unsaved while the initial load is still in flight", async () => {
    // The flash-of-unsaved-state: the heart renders empty until the query
    // returns, even for a sitter the user has already saved.
    h.selectResult = { data: rows("s-1"), error: null };
    const { result } = renderHook(() => useFavorites(), { wrapper });
    expect(result.current.isFavorite("s-1")).toBe(false);
    await waitFor(() => expect(result.current.isFavorite("s-1")).toBe(true));
  });
});

describe("toggle", () => {
  it("adds a sitter and inserts a row", async () => {
    const { result } = await mount([]);
    await act(async () => {
      result.current.toggle("s-1");
    });
    expect(result.current.isFavorite("s-1")).toBe(true);
    expect(opsMatching("insert")).toHaveLength(1);
  });

  it("removes a sitter and deletes scoped to both the user and the sitter", async () => {
    const { result } = await mount(["s-1"]);
    await act(async () => {
      result.current.toggle("s-1");
    });
    expect(result.current.isFavorite("s-1")).toBe(false);
    expect(h.calls).toContainEqual({ op: "delete", args: [] });
    expect(h.calls).toContainEqual({ op: "delete.eq", args: ["user_id", "u-1"] });
    expect(h.calls).toContainEqual({ op: "delete.eq", args: ["sitter_id", "s-1"] });
  });

  // The insert relies on a database default or trigger to populate user_id.
  // Asserting the exact payload means a schema change that drops that default
  // is caught by this test rather than by rows silently landing on no user.
  it("inserts only the sitter id, leaving user_id to the database", async () => {
    const { result } = await mount([]);
    await act(async () => {
      result.current.toggle("s-1");
    });
    expect(h.calls).toContainEqual({ op: "insert", args: [{ sitter_id: "s-1" }] });
  });

  it("does nothing at all when signed out", async () => {
    h.user = null;
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.toggle("s-1");
    });

    expect(result.current.count).toBe(0);
    expect(opsMatching("insert")).toHaveLength(0);
    expect(opsMatching("delete")).toHaveLength(0);
  });

  it("round-trips a sitter back to unsaved when toggled twice in sequence", async () => {
    const { result } = await mount([]);
    await act(async () => {
      result.current.toggle("s-1");
    });
    await act(async () => {
      result.current.toggle("s-1");
    });
    expect(result.current.isFavorite("s-1")).toBe(false);
    expect(opsMatching("insert")).toHaveLength(1);
    expect(opsMatching("delete")).toHaveLength(1);
  });

  it("tracks two different sitters independently", async () => {
    const { result } = await mount([]);
    await act(async () => {
      result.current.toggle("s-1");
    });
    await act(async () => {
      result.current.toggle("s-2");
    });
    expect(result.current.favorites).toEqual(new Set(["s-1", "s-2"]));
  });

  it("accepts an empty-string sitter id with no validation", async () => {
    const { result } = await mount([]);
    await act(async () => {
      result.current.toggle("");
    });
    expect(result.current.favorites.has("")).toBe(true);
  });

  // BUG (src/context/FavoritesContext.tsx:46-50): the optimistic state update
  // is never rolled back. The awaited delete/insert result is discarded without
  // checking `error`, so an offline write, an RLS denial or a unique-constraint
  // race all leave the heart filled while the database holds nothing. The user
  // believes the sitter is saved; reloading the page proves otherwise.
  // Correct behaviour would be to restore the previous Set and surface the
  // failure when the mutation errors.
  it("keeps the optimistic state when the write fails (current buggy behaviour)", async () => {
    const { result } = await mount([]);
    h.mutationResult = { data: null, error: { message: "permission denied" } };

    await act(async () => {
      result.current.toggle("s-1");
    });

    // The insert failed, yet the UI still reports the sitter as saved.
    expect(result.current.isFavorite("s-1")).toBe(true);
    expect(opsMatching("insert")).toHaveLength(1);
  });

  it("keeps an optimistic removal when the delete fails (current buggy behaviour)", async () => {
    const { result } = await mount(["s-1"]);
    h.mutationResult = { data: null, error: { message: "network" } };

    await act(async () => {
      result.current.toggle("s-1");
    });

    expect(result.current.isFavorite("s-1")).toBe(false);
  });

  // BUG (src/context/FavoritesContext.tsx:40): `has` is read from the closure
  // over `favorites`, while the update itself is functional. Two toggles fired
  // in the same tick therefore observe the SAME stale `has` value, so both take
  // the same branch: two inserts (or two deletes) for one sitter, and a final
  // state that does not reflect the number of clicks. FavoriteButton has no
  // disabled state, so a double-click reaches exactly this path.
  // Correct behaviour would be to derive `has` inside the functional update.
  it("issues two identical writes for a double toggle in one tick (current buggy behaviour)", async () => {
    const { result } = await mount([]);

    await act(async () => {
      result.current.toggle("s-1");
      result.current.toggle("s-1");
    });

    // Both calls saw has === false, so both inserted...
    expect(opsMatching("insert")).toHaveLength(2);
    expect(opsMatching("delete")).toHaveLength(0);
    // ...and the sitter ends up saved, despite an even number of clicks.
    expect(result.current.isFavorite("s-1")).toBe(true);
  });
});

describe("default context outside a provider", () => {
  it("reports nothing favourited and makes toggle a silent no-op", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.count).toBe(0);
    expect(result.current.isFavorite("s-1")).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(() => result.current.toggle("s-1")).not.toThrow();
  });
});
