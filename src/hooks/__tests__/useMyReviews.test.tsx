import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useMyReviews } from "@/hooks/useMyReviews";

const h = vi.hoisted(() => ({
  /** Rows the `.in()` read resolves with, and the error it resolves with. */
  read: { data: [] as unknown[] | null, error: null as unknown },
  /** Result of the next insert and the next update. */
  insert: { data: null as unknown, error: null as unknown },
  update: { data: null as unknown, error: null as unknown },
  calls: [] as Array<{ op: string; args: unknown[] }>,
}));

vi.mock("@/lib/supabase", () => {
  const record = (op: string, ...args: unknown[]) => h.calls.push({ op, args });

  return {
    supabase: {
      from: (table: string) => {
        record("from", table);
        return {
          select: (...a: unknown[]) => {
            record("select", ...a);
            return {
              in: (col: string, ids: string[]) => {
                record("in", col, ids);
                return Promise.resolve(h.read);
              },
            };
          },
          insert: (row: unknown) => {
            record("insert", row);
            return {
              select: () => ({ single: () => Promise.resolve(h.insert) }),
            };
          },
          update: (patch: unknown) => {
            record("update", patch);
            return {
              eq: (col: string, value: unknown) => {
                record("update.eq", col, value);
                return { select: () => ({ single: () => Promise.resolve(h.update) }) };
              },
            };
          },
        };
      },
    },
  };
});

const opsNamed = (op: string) => h.calls.filter((c) => c.op === op);

function review(over: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    booking_id: "b-1",
    owner_id: "owner-1",
    sitter_id: "sitter-1",
    rating: 4,
    body: "Good.",
    created_at: "2026-09-01T10:00:00Z",
    ...over,
  };
}

const target = { bookingId: "b-1", sitterId: "sitter-1", ownerId: "owner-1" };

beforeEach(() => {
  // vitest.config sets restoreMocks, but in Vitest 4 that restores spies made with
  // vi.spyOn and does not clear a plain recorder like this one. Without the reset the
  // "one query" assertions count every previous test's calls and pass or fail
  // depending on file order — the same trap useSitterRatings hit.
  h.calls = [];
  h.read = { data: [], error: null };
  h.insert = { data: null, error: null };
  h.update = { data: null, error: null };
});

describe("useMyReviews — reading", () => {
  it("asks for nothing when no completed bookings are on screen", async () => {
    // The bookings page mounts before its bookings load, and most owners have no
    // completed bookings at all.
    const { result } = renderHook(() => useMyReviews([]));
    expect(opsNamed("from")).toHaveLength(0);
    expect(result.current.reviews.size).toBe(0);
  });

  it("fetches every visible booking in one query rather than one per card", async () => {
    h.read = { data: [review({ booking_id: "b-1" }), review({ id: "r-2", booking_id: "b-2" })], error: null };

    const { result } = renderHook(() => useMyReviews(["b-1", "b-2"]));

    await waitFor(() => expect(result.current.reviews.size).toBe(2));
    expect(opsNamed("in")).toHaveLength(1);
    expect(opsNamed("in")[0].args).toEqual(["booking_id", ["b-1", "b-2"]]);
  });

  it("keys the result by booking, which is how a card finds its own review", () => {
    h.read = { data: [review({ booking_id: "b-7" })], error: null };

    const { result } = renderHook(() => useMyReviews(["b-7"]));

    return waitFor(() => {
      expect(result.current.reviews.get("b-7")?.rating).toBe(4);
    });
  });

  it("treats a booking with no review as unreviewed rather than as a failure", async () => {
    h.read = { data: [], error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reviews.get("b-1")).toBeUndefined();
  });

  it("does not re-query when the same ids arrive in a new array", async () => {
    // Every call site builds this list inline from state, so a fresh array arrives
    // on every render; an identity-keyed effect would query forever.
    const { result, rerender } = renderHook(({ ids }) => useMyReviews(ids), {
      initialProps: { ids: ["b-1", "b-2"] },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ ids: ["b-1", "b-2"] });
    rerender({ ids: ["b-1", "b-2"] });

    expect(opsNamed("in")).toHaveLength(1);
  });

  it("yields no reviews when the query fails, so the bookings still render", async () => {
    h.read = { data: null, error: { message: "network" } };

    const { result } = renderHook(() => useMyReviews(["b-1"]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reviews.size).toBe(0);
  });
});

describe("useMyReviews — writing", () => {
  it("inserts when the booking has never been reviewed", async () => {
    h.insert = { data: review({ rating: 5, body: "Excellent." }), error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveReview(target, { rating: 5, body: "Excellent." });
    });

    expect(opsNamed("insert")).toHaveLength(1);
    expect(opsNamed("update")).toHaveLength(0);
  });

  it("sends owner_id and sitter_id on insert, because the policy re-checks both", async () => {
    // reviews_insert_own_completed_booking verifies the denormalised columns against
    // the booking. Letting the database infer them is not an option: it does not.
    h.insert = { data: review(), error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveReview(target, { rating: 4, body: "Good." });
    });

    expect(opsNamed("insert")[0].args[0]).toEqual({
      booking_id: "b-1",
      owner_id: "owner-1",
      sitter_id: "sitter-1",
      rating: 4,
      body: "Good.",
    });
  });

  it("updates when a review for that booking already exists", async () => {
    h.read = { data: [review({ booking_id: "b-1" })], error: null };
    h.update = { data: review({ rating: 2, body: "Changed my mind." }), error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.reviews.size).toBe(1));

    await act(async () => {
      await result.current.saveReview(target, { rating: 2, body: "Changed my mind." });
    });

    expect(opsNamed("update")).toHaveLength(1);
    expect(opsNamed("insert")).toHaveLength(0);
  });

  it("changes only the rating and the body on update", async () => {
    // reviews.Update is narrowed to these two columns for a reason: the policy
    // re-asserts every identifying column, so moving a review is a failed round trip.
    h.read = { data: [review({ booking_id: "b-1" })], error: null };
    h.update = { data: review({ rating: 1, body: null }), error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.reviews.size).toBe(1));

    await act(async () => {
      await result.current.saveReview(target, { rating: 1, body: null });
    });

    expect(opsNamed("update")[0].args[0]).toEqual({ rating: 1, body: null });
    expect(opsNamed("update.eq")[0].args).toEqual(["booking_id", "b-1"]);
  });

  it("shows the new review straight away, without a second read", async () => {
    h.insert = { data: review({ rating: 5, body: "Excellent." }), error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveReview(target, { rating: 5, body: "Excellent." });
    });

    expect(result.current.reviews.get("b-1")?.rating).toBe(5);
    expect(opsNamed("in")).toHaveLength(1);
  });

  it("turns a duplicate-key insert into an update instead of an error", async () => {
    // booking_id is UNIQUE. Two tabs, or a stale map, and the insert loses the race
    // with 23505 — which means the review exists, not that anything went wrong.
    h.insert = { data: null, error: { code: "23505", message: "duplicate key" } };
    h.update = { data: review({ rating: 3, body: "Second attempt." }), error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveReview(target, { rating: 3, body: "Second attempt." });
    });

    expect(opsNamed("update")).toHaveLength(1);
    expect(result.current.reviews.get("b-1")?.rating).toBe(3);
    expect(result.current.error).toBeNull();
  });

  it("reports a rejected write rather than pretending it saved", async () => {
    // An RLS refusal — the booking is not completed, or is not theirs — must not
    // leave the card showing a review the database does not have.
    h.insert = { data: null, error: { code: "42501", message: "denied" } };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveReview(target, { rating: 5, body: null });
    });

    // The caller has to be able to tell, because BookingReview keeps its form open
    // on a refusal. A promise that merely resolved would read as success.
    expect(saved).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.reviews.get("b-1")).toBeUndefined();
  });

  it("says so when the write succeeded", async () => {
    h.insert = { data: review({ rating: 5 }), error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveReview(target, { rating: 5, body: null });
    });

    expect(saved).toBe(true);
  });

  it("says so when a duplicate insert was recovered by updating", async () => {
    h.insert = { data: null, error: { code: "23505", message: "duplicate key" } };
    h.update = { data: review({ rating: 3 }), error: null };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveReview(target, { rating: 3, body: null });
    });

    expect(saved).toBe(true);
  });

  it("clears a previous failure when a later save succeeds", async () => {
    h.insert = { data: null, error: { code: "42501", message: "denied" } };

    const { result } = renderHook(() => useMyReviews(["b-1"]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveReview(target, { rating: 5, body: null });
    });
    expect(result.current.error).toBeTruthy();

    h.insert = { data: review({ rating: 5 }), error: null };
    await act(async () => {
      await result.current.saveReview(target, { rating: 5, body: null });
    });

    expect(result.current.error).toBeNull();
  });
});
