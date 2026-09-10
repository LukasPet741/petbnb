import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSitterRatings } from "@/hooks/useSitterRatings";

const { fromMock, selectMock, inMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  inMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { from: fromMock } }));

type Row = { sitter_id: string; review_count: number; average_rating: number };

/** Points the mocked chain at one result. restoreMocks wipes implementations
 *  between tests, so every test sets its own rather than sharing a default. */
function respondWith(rows: Row[] | null, error: unknown = null) {
  inMock.mockResolvedValue({ data: rows, error });
  selectMock.mockReturnValue({ in: inMock });
  fromMock.mockReturnValue({ select: selectMock });
}

beforeEach(() => {
  // vitest.config sets restoreMocks, but in Vitest 4 that restores spies created
  // with vi.spyOn — it does not clear the call history of a plain vi.fn(). Without
  // this reset the "called once" assertions below count every previous test's
  // queries too, and pass or fail depending on the order they ran in.
  fromMock.mockReset();
  selectMock.mockReset();
  inMock.mockReset();
  respondWith([]);
});

describe("useSitterRatings", () => {
  it("asks for nothing when there are no sitters on screen", async () => {
    // An empty `.in()` list is a pointless round trip on every first render, since
    // these pages all mount before their sitters have loaded.
    const { result } = renderHook(() => useSitterRatings([]));
    expect(fromMock).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it("fetches every visible sitter in one query rather than one per card", async () => {
    respondWith([
      { sitter_id: "a", review_count: 12, average_rating: 4.8 },
      { sitter_id: "b", review_count: 1, average_rating: 5 },
    ]);

    const { result } = renderHook(() => useSitterRatings(["a", "b"]));

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("sitter_ratings");
    expect(inMock).toHaveBeenCalledWith("sitter_id", ["a", "b"]);
    expect(result.current.get("a")).toEqual({ average: 4.8, count: 12 });
    expect(result.current.get("b")).toEqual({ average: 5, count: 1 });
  });

  it("omits a sitter the view has no row for, so the caller sees unrated", async () => {
    // sitter_ratings is a GROUP BY over reviews: a sitter nobody reviewed has no
    // row at all, which is the normal case today rather than an error.
    respondWith([{ sitter_id: "a", review_count: 3, average_rating: 4 }]);

    const { result } = renderHook(() => useSitterRatings(["a", "b"]));

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.has("b")).toBe(false);
  });

  it("returns an empty map when the query fails, rather than breaking the listing", async () => {
    respondWith(null, { message: "network" });

    const { result } = renderHook(() => useSitterRatings(["a"]));

    await waitFor(() => expect(fromMock).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });

  it("does not re-query when the same sitters arrive in a freshly built array", async () => {
    // Every call site builds this list inline from state, so a new array identity
    // on each render is the norm. Keying the effect on identity would loop forever.
    respondWith([{ sitter_id: "a", review_count: 2, average_rating: 3 }]);

    const { result, rerender } = renderHook(({ ids }) => useSitterRatings(ids), {
      initialProps: { ids: ["a"] },
    });
    await waitFor(() => expect(result.current.size).toBe(1));

    rerender({ ids: ["a"] });
    rerender({ ids: ["a"] });

    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("re-queries when the visible sitters actually change", async () => {
    respondWith([{ sitter_id: "a", review_count: 2, average_rating: 3 }]);

    const { rerender } = renderHook(({ ids }) => useSitterRatings(ids), {
      initialProps: { ids: ["a"] },
    });
    await waitFor(() => expect(fromMock).toHaveBeenCalledTimes(1));

    rerender({ ids: ["a", "b"] });

    await waitFor(() => expect(fromMock).toHaveBeenCalledTimes(2));
    expect(inMock).toHaveBeenLastCalledWith("sitter_id", ["a", "b"]);
  });

  it("discards a row whose average is out of range rather than trusting the view", async () => {
    // Same rule as averageRating: a stray 0 or 50 must not reach a card that
    // readers treat as fact.
    respondWith([
      { sitter_id: "a", review_count: 4, average_rating: 0 },
      { sitter_id: "b", review_count: 4, average_rating: 50 },
      { sitter_id: "c", review_count: 4, average_rating: 4.2 },
    ]);

    const { result } = renderHook(() => useSitterRatings(["a", "b", "c"]));

    await waitFor(() => expect(result.current.size).toBeGreaterThan(0));
    expect(result.current.get("a")?.average).toBeNull();
    expect(result.current.get("b")?.average).toBeNull();
    expect(result.current.get("c")?.average).toBe(4.2);
  });
});
