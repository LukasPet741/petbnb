import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  NotificationsProvider,
  useNotifications,
} from "@/context/NotificationsContext";
import type { AppNotification, NotificationType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mocks. The provider owns a Supabase query, three RPCs and a realtime channel.
// The query builder is thenable at the end of the chain, matching the real
// client, and every call is recorded so ordering can be asserted.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  selectResult: { data: [] as unknown[] | null, error: null as unknown },
  rpcResults: {} as Record<string, { data: unknown; error: unknown }>,
  calls: [] as Array<{ op: string; args: unknown[] }>,
  channels: [] as Array<{ name: string; removed: boolean; handlers: Array<() => void> }>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: h.user, session: null, loading: false }),
}));

vi.mock("@/lib/supabase", () => {
  const record = (op: string, ...args: unknown[]) => h.calls.push({ op, args });

  const queryChain = () => {
    const chain = {
      order: (...args: unknown[]) => {
        record("order", ...args);
        return chain;
      },
      limit: (...args: unknown[]) => {
        record("limit", ...args);
        return chain;
      },
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(h.selectResult).then(resolve),
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
            return queryChain();
          },
        };
      },
      rpc: async (name: string, params: unknown) => {
        record(`rpc:${name}`, params);
        return h.rpcResults[name] ?? { data: null, error: null };
      },
      channel: (name: string) => {
        const entry = { name, removed: false, handlers: [] as Array<() => void> };
        h.channels.push(entry);
        record("channel", name);
        const api = {
          on: (_evt: string, cfg: unknown, cb: () => void) => {
            record("on", cfg);
            entry.handlers.push(cb);
            return api;
          },
          subscribe: () => {
            record("subscribe", name);
            return entry;
          },
        };
        return api;
      },
      removeChannel: (channel: { name: string; removed: boolean }) => {
        channel.removed = true;
        record("removeChannel", channel.name);
      },
    },
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <NotificationsProvider>{children}</NotificationsProvider>
);

let seq = 0;
function notif(over: Partial<AppNotification> = {}): AppNotification {
  seq += 1;
  return {
    id: `n-${seq}`,
    user_id: "u-1",
    actor_id: "a-1",
    booking_id: "b-1",
    type: "booking_requested" as NotificationType,
    read_at: null,
    created_at: "2026-09-01T10:00:00Z",
    ...over,
  } as AppNotification;
}

const opsMatching = (op: string) => h.calls.filter((c) => c.op === op);
const rpcCalls = (name: string) => h.calls.filter((c) => c.op === `rpc:${name}`);

beforeEach(() => {
  seq = 0;
  h.user = { id: "u-1" };
  h.selectResult = { data: [], error: null };
  h.rpcResults = {};
  h.calls = [];
  h.channels = [];
});

afterEach(() => {
  vi.useRealTimers();
});

async function mount(rows: AppNotification[] = []) {
  h.selectResult = { data: rows, error: null };
  const view = renderHook(() => useNotifications(), { wrapper });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe("loading", () => {
  it("fetches the newest 50 notifications, newest first", async () => {
    await mount([notif()]);
    expect(h.calls).toContainEqual({ op: "from", args: ["notifications"] });
    expect(h.calls).toContainEqual({
      op: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(h.calls).toContainEqual({ op: "limit", args: [50] });
  });

  it("clears the list and stops loading when signed out", async () => {
    h.user = null;
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toEqual([]);
    expect(opsMatching("from")).toHaveLength(0);
  });

  it("treats a null data payload as an empty list", async () => {
    h.selectResult = { data: null, error: null };
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toEqual([]);
  });

  // BUG (src/context/NotificationsContext.tsx:70): the guard is `if (!error)`,
  // so a failed refetch silently keeps whatever was already on screen and still
  // flips loading to false. The bell shows a stale count with no error state and
  // no retry, indistinguishable from a successful empty result.
  // Correct behaviour would be to surface the failure to the consumer.
  it("keeps the previous list when a refetch errors (current buggy behaviour)", async () => {
    const { result } = await mount([notif({ id: "n-keep" })]);
    expect(result.current.notifications).toHaveLength(1);

    h.selectResult = { data: null, error: { message: "network" } };
    h.rpcResults["mark_notifications_read"] = { data: null, error: { message: "boom" } };

    await act(async () => {
      await result.current.markRead(["n-keep"]);
    });

    // The rollback refetch failed, yet the stale row is still there.
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });
});

describe("unreadCount", () => {
  it("is zero for an empty list", async () => {
    const { result } = await mount([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("counts only rows with no read timestamp", async () => {
    const { result } = await mount([
      notif({ read_at: null }),
      notif({ read_at: "2026-09-01T11:00:00Z" }),
      notif({ read_at: null }),
    ]);
    expect(result.current.unreadCount).toBe(2);
  });

  it("is zero when everything has been read", async () => {
    const { result } = await mount([
      notif({ read_at: "2026-09-01T11:00:00Z" }),
      notif({ read_at: "2026-09-01T12:00:00Z" }),
    ]);
    expect(result.current.unreadCount).toBe(0);
  });

  // An empty string is falsy, so it reads as unread. Pinned because a database
  // default of '' rather than NULL would silently inflate the badge forever.
  it("treats an empty-string read_at as unread", async () => {
    const { result } = await mount([notif({ read_at: "" })]);
    expect(result.current.unreadCount).toBe(1);
  });

  it("crosses the badge's 9-to-10 boundary", async () => {
    const nine = await mount(Array.from({ length: 9 }, () => notif({ read_at: null })));
    expect(nine.result.current.unreadCount).toBe(9);
    nine.unmount();

    const ten = await mount(Array.from({ length: 10 }, () => notif({ read_at: null })));
    expect(ten.result.current.unreadCount).toBe(10);
  });

  // The query is capped at 50 rows, so the count is capped too. A user with 60
  // genuinely unread notifications sees 50. The bell renders "9+" either way,
  // which is what hides this in practice.
  it("cannot report more than the 50-row query limit", async () => {
    const { result } = await mount(
      Array.from({ length: 50 }, () => notif({ read_at: null })),
    );
    expect(result.current.unreadCount).toBe(50);
  });
});

describe("unreadByBooking", () => {
  it("is empty for an empty list", async () => {
    const { result } = await mount([]);
    expect(result.current.unreadByBooking).toEqual({});
  });

  it("accumulates unread rows per booking", async () => {
    const { result } = await mount([
      notif({ booking_id: "b-1", read_at: null }),
      notif({ booking_id: "b-1", read_at: null }),
      notif({ booking_id: "b-2", read_at: null }),
    ]);
    expect(result.current.unreadByBooking).toEqual({ "b-1": 2, "b-2": 1 });
  });

  it("skips rows that have been read", async () => {
    const { result } = await mount([
      notif({ booking_id: "b-1", read_at: "2026-09-01T11:00:00Z" }),
      notif({ booking_id: "b-1", read_at: null }),
    ]);
    expect(result.current.unreadByBooking).toEqual({ "b-1": 1 });
  });

  it("skips rows with no booking, so account-level notices never appear", async () => {
    const { result } = await mount([notif({ booking_id: null, read_at: null })]);
    expect(result.current.unreadByBooking).toEqual({});
  });

  // BUG (src/context/NotificationsContext.tsx:159-163): the accumulator is a
  // plain object literal, so a booking id colliding with an inherited
  // Object.prototype member reads back that member rather than undefined. The
  // `?? 0` fallback only catches null/undefined, so a function sails through
  // and the `+ 1` becomes string concatenation - the "count" for that thread is
  // the source text of Object with a 1 stuck on the end. Booking ids are UUIDs
  // today, so this is latent; Object.create(null) would remove the whole class.
  it("concatenates onto an inherited member for a booking id of 'constructor' (current buggy behaviour)", async () => {
    const { result } = await mount([
      notif({ booking_id: "constructor", read_at: null }),
    ]);
    const count = result.current.unreadByBooking["constructor"];
    expect(typeof count).toBe("string");
    expect(count as unknown as string).toContain("function Object()");
    expect(count as unknown as string).toMatch(/1$/);
  });
});

describe("markRead", () => {
  it("sends no RPC at all for an empty id list", async () => {
    const { result } = await mount([notif()]);
    await act(async () => {
      await result.current.markRead([]);
    });
    expect(rpcCalls("mark_notifications_read")).toHaveLength(0);
  });

  it("stamps the named rows and sends exactly those ids", async () => {
    const { result } = await mount([
      notif({ id: "n-a", read_at: null }),
      notif({ id: "n-b", read_at: null }),
    ]);

    await act(async () => {
      await result.current.markRead(["n-a"]);
    });

    expect(result.current.notifications[0].read_at).toBeTruthy();
    expect(result.current.notifications[1].read_at).toBeNull();
    expect(rpcCalls("mark_notifications_read")).toEqual([
      { op: "rpc:mark_notifications_read", args: [{ p_ids: ["n-a"] }] },
    ]);
  });

  it("preserves the original timestamp of an already-read row", async () => {
    // The guard is `ids.includes(id) && !n.read_at`, so re-marking must not
    // rewrite when the notification was first seen.
    const original = "2026-09-01T08:00:00Z";
    const { result } = await mount([notif({ id: "n-a", read_at: original })]);

    await act(async () => {
      await result.current.markRead(["n-a"]);
    });

    expect(result.current.notifications[0].read_at).toBe(original);
  });

  it("ignores ids that are not in the current list", async () => {
    const { result } = await mount([notif({ id: "n-a", read_at: null })]);
    await act(async () => {
      await result.current.markRead(["n-missing"]);
    });
    expect(result.current.notifications[0].read_at).toBeNull();
  });

  it("refetches as a rollback when the RPC fails", async () => {
    const { result } = await mount([notif({ id: "n-a", read_at: null })]);
    h.rpcResults["mark_notifications_read"] = { data: null, error: { message: "denied" } };
    const before = opsMatching("from").length;

    await act(async () => {
      await result.current.markRead(["n-a"]);
    });

    expect(opsMatching("from").length).toBeGreaterThan(before);
  });
});

describe("markAllRead", () => {
  it("stamps every unread row and asks the RPC for all of them with a null id list", async () => {
    const { result } = await mount([
      notif({ read_at: null }),
      notif({ read_at: null }),
    ]);

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(rpcCalls("mark_notifications_read")).toEqual([
      { op: "rpc:mark_notifications_read", args: [{ p_ids: null }] },
    ]);
  });

  it("leaves already-read timestamps untouched", async () => {
    const original = "2026-09-01T08:00:00Z";
    const { result } = await mount([
      notif({ id: "n-old", read_at: original }),
      notif({ id: "n-new", read_at: null }),
    ]);

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.notifications[0].read_at).toBe(original);
    expect(result.current.notifications[1].read_at).not.toBe(original);
  });
});

describe("markThreadRead", () => {
  it("clears the thread optimistically and calls the thread RPC", async () => {
    const { result } = await mount([
      notif({ booking_id: "b-1", type: "message_received", read_at: null }),
      notif({ booking_id: "b-2", read_at: null }),
    ]);

    await act(async () => {
      await result.current.markThreadRead("b-1");
    });

    expect(result.current.unreadByBooking).toEqual({ "b-2": 1 });
    expect(rpcCalls("mark_thread_read")).toEqual([
      { op: "rpc:mark_thread_read", args: [{ p_booking_id: "b-1" }] },
    ]);
  });

  it("skips the second RPC when the thread holds only message notifications", async () => {
    // mark_thread_read already covers message_received rows, so a second call
    // would be pure waste.
    await mountAndMark([
      notif({ booking_id: "b-1", type: "message_received", read_at: null }),
    ]);
    expect(rpcCalls("mark_notifications_read")).toHaveLength(0);
  });

  it("skips the second RPC when nothing in the thread is unread", async () => {
    await mountAndMark([
      notif({ booking_id: "b-1", type: "booking_requested", read_at: "2026-09-01T11:00:00Z" }),
    ]);
    expect(rpcCalls("mark_notifications_read")).toHaveLength(0);
  });

  it("sends exactly the booking-status ids for a mixed thread", async () => {
    await mountAndMark([
      notif({ id: "n-msg", booking_id: "b-1", type: "message_received", read_at: null }),
      notif({ id: "n-acc", booking_id: "b-1", type: "booking_accepted", read_at: null }),
      notif({ id: "n-other", booking_id: "b-2", type: "booking_accepted", read_at: null }),
    ]);
    expect(rpcCalls("mark_notifications_read")).toEqual([
      { op: "rpc:mark_notifications_read", args: [{ p_ids: ["n-acc"] }] },
    ]);
  });

  async function mountAndMark(rows: AppNotification[]) {
    const view = await mount(rows);
    await act(async () => {
      await view.result.current.markThreadRead("b-1");
    });
    return view;
  }

  // BUG (src/context/NotificationsContext.tsx:146-154): the error from the
  // FIRST rpc is captured, but only checked at the very end - after the second
  // rpc has already been issued. So when mark_thread_read fails, the follow-up
  // write still goes out against a thread whose primary update did not land,
  // and only then is the rollback refetch triggered.
  // Correct behaviour would be to check and bail immediately after the first call.
  it("issues the follow-up RPC even after the thread RPC failed (current buggy behaviour)", async () => {
    h.rpcResults["mark_thread_read"] = { data: null, error: { message: "denied" } };
    await mountAndMark([
      notif({ id: "n-acc", booking_id: "b-1", type: "booking_accepted", read_at: null }),
    ]);

    const order = h.calls.filter((c) => c.op.startsWith("rpc:")).map((c) => c.op);
    expect(order).toEqual(["rpc:mark_thread_read", "rpc:mark_notifications_read"]);
  });
});

describe("realtime subscription", () => {
  it("opens one channel scoped to the signed-in user", async () => {
    await mount([]);
    expect(opsMatching("channel")).toEqual([
      { op: "channel", args: ["notifications:u-1"] },
    ]);
  });

  it("subscribes to inserts and updates filtered to that user", async () => {
    await mount([]);
    const filters = opsMatching("on").map(
      (c) => c.args[0] as { event: string; filter: string; table: string },
    );
    expect(filters.map((f) => f.event)).toEqual(["INSERT", "UPDATE"]);
    for (const f of filters) {
      expect(f.table).toBe("notifications");
      expect(f.filter).toBe("user_id=eq.u-1");
    }
  });

  it("opens no channel at all when signed out", async () => {
    h.user = null;
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(opsMatching("channel")).toHaveLength(0);
  });

  it("removes the channel on unmount", async () => {
    const { unmount } = await mount([]);
    unmount();
    expect(opsMatching("removeChannel")).toEqual([
      { op: "removeChannel", args: ["notifications:u-1"] },
    ]);
    expect(h.channels.every((c) => c.removed)).toBe(true);
  });

  it("refetches when a realtime row arrives", async () => {
    const { result } = await mount([]);
    const before = opsMatching("from").length;

    h.selectResult = { data: [notif({ read_at: null })], error: null };
    await act(async () => {
      h.channels[0].handlers[0]();
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(opsMatching("from").length).toBeGreaterThan(before);
  });

  // There is no debounce: every incoming row triggers a full refetch of 50
  // joined rows. A burst of notifications means a burst of queries.
  it("refetches once per row with no debouncing (current behaviour)", async () => {
    await mount([]);
    const before = opsMatching("from").length;

    await act(async () => {
      h.channels[0].handlers[0]();
      h.channels[0].handlers[0]();
      h.channels[0].handlers[0]();
    });

    expect(opsMatching("from").length).toBe(before + 3);
  });
});

describe("default context outside a provider", () => {
  it("reports an empty, still-loading state and no-op actions", () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.unreadByBooking).toEqual({});
    expect(result.current.loading).toBe(true);
  });
});
