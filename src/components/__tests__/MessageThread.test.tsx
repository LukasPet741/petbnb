import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MessageThread from "@/components/MessageThread";
import { LanguageProvider } from "@/context/LanguageContext";

// ---------------------------------------------------------------------------
// Mocks. The component issues two parallel queries on mount, opens a realtime
// channel, inserts on send, and calls markThreadRead through a ref. All four
// surfaces are stubbed here; `h` is the knob panel each test turns.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  user: { id: "u-owner" } as { id: string } | null,
  bookingResult: { data: null as unknown, error: null as unknown },
  messagesResult: { data: [] as unknown[], error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown },
  insertGate: null as Promise<void> | null,
  markThreadRead: vi.fn(),
  calls: [] as Array<{ op: string; args: unknown[] }>,
  channels: [] as Array<{
    name: string;
    removed: boolean;
    emit: ((row: Record<string, unknown>) => void) | null;
  }>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: h.user, session: null, loading: false }),
}));

vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    unreadByBooking: {},
    loading: false,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    markThreadRead: h.markThreadRead,
  }),
}));

vi.mock("@/lib/supabase", () => {
  const record = (op: string, ...args: unknown[]) => h.calls.push({ op, args });

  const bookingChain = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => {
        record("bookings.maybeSingle");
        return h.bookingResult;
      },
    };
    return chain;
  };

  const messagesChain = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: async () => {
        record("messages.order");
        return h.messagesResult;
      },
      insert: (payload: unknown) => {
        record("messages.insert", payload);
        return {
          select: () => ({
            single: async () => {
              if (h.insertGate) await h.insertGate;
              return h.insertResult;
            },
          }),
        };
      },
    };
    return chain;
  };

  return {
    supabase: {
      // LanguageProvider (wrapped around these tests so interpolation runs)
      // subscribes to auth on mount and mirrors the locale to a profile row.
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
      from: (table: string) =>
        table === "profiles"
          ? { update: () => ({ eq: async () => ({ error: null }) }) }
          : table === "bookings"
            ? bookingChain()
            : messagesChain(),
      channel: (name: string) => {
        const entry = { name, removed: false, emit: null as null | ((r: Record<string, unknown>) => void) };
        h.channels.push(entry);
        record("channel", name);
        const api = {
          on: (_evt: string, _cfg: unknown, cb: (p: { new: Record<string, unknown> }) => void) => {
            entry.emit = (row) => cb({ new: row });
            return api;
          },
          subscribe: () => entry,
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

// jsdom implements neither, and the component calls both on every render pass.
beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    value: 40,
  });
});

const OWNER = "u-owner";
const SITTER = "u-sitter";

const party = (id: string, name: string | null) => ({
  id,
  full_name: name,
  avatar_url: null,
});

function bookingRow(over: Record<string, unknown> = {}) {
  return {
    id: "b-1",
    status: "signed",
    service: "walking",
    start_at: "2026-09-10T09:00:00Z",
    end_at: "2026-09-12T17:00:00Z",
    owner_id: OWNER,
    sitter_id: SITTER,
    owner: party(OWNER, "Ana Owner"),
    sitter: party(SITTER, "Jonas Sitter"),
    pet: { id: "p-1", name: "Rex" },
    ...over,
  };
}

let msgSeq = 0;
function messageRow(over: Record<string, unknown> = {}) {
  msgSeq += 1;
  return {
    id: `m-${msgSeq}`,
    booking_id: "b-1",
    sender_id: OWNER,
    kind: "user",
    body: `message ${msgSeq}`,
    event: null,
    created_at: "2026-09-01T10:00:00Z",
    sender: party(OWNER, "Ana Owner"),
    ...over,
  };
}

const opsMatching = (op: string) => h.calls.filter((c) => c.op === op);
const composer = () => screen.getByRole("textbox");
const log = () => screen.getByRole("log");

beforeEach(() => {
  msgSeq = 0;
  h.user = { id: OWNER };
  h.bookingResult = { data: bookingRow(), error: null };
  h.messagesResult = { data: [], error: null };
  h.insertResult = { data: null, error: null };
  h.insertGate = null;
  h.markThreadRead = vi.fn();
  h.calls = [];
  h.channels = [];
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Rendered inside a real LanguageProvider rather than relying on the default
 * identity `t`. The header and the pet line pass interpolation vars, and the
 * identity function discards them - so the counterparty name would never
 * appear in the DOM and those assertions would be untestable.
 */
const withLanguage = (ui: React.ReactElement) => (
  <LanguageProvider>{ui}</LanguageProvider>
);

function renderThread() {
  return render(withLanguage(<MessageThread bookingId="b-1" />));
}

async function mount(messages: unknown[] = []) {
  h.messagesResult = { data: messages, error: null };
  const view = renderThread();
  await waitFor(() => expect(screen.queryByRole("log")).toBeInTheDocument());
  return view;
}

describe("load states", () => {
  it("shows the thread once both queries resolve", async () => {
    await mount([messageRow({ body: "hello there" })]);
    expect(screen.getByText("hello there")).toBeInTheDocument();
  });

  it("shows the not-a-party empty state when the booking row is hidden by RLS", async () => {
    h.bookingResult = { data: null, error: null };
    renderThread();
    await waitFor(() =>
      expect(screen.getByText(/isn't yours to view/i)).toBeInTheDocument(),
    );
  });

  it("shows the load-failed empty state when the booking query errors", async () => {
    h.bookingResult = { data: null, error: { message: "boom" } };
    renderThread();
    await waitFor(() =>
      expect(screen.getByText(/Could not load this conversation/i)).toBeInTheDocument(),
    );
  });

  it("shows the load-failed empty state when the messages query errors", async () => {
    h.messagesResult = { data: [], error: { message: "boom" } };
    renderThread();
    await waitFor(() =>
      expect(screen.getByText(/Could not load this conversation/i)).toBeInTheDocument(),
    );
  });

  // The load effect returns before setLoading(false) when there is no user, so
  // the spinner is not a transient state - it is the permanent one. A signed
  // out visitor deep-linking to a thread waits forever with no explanation.
  it("never leaves the spinner when there is no signed-in user (current behaviour)", async () => {
    h.user = null;
    renderThread();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByText(/Could not load this conversation/i)).not.toBeInTheDocument();
    expect(opsMatching("bookings.maybeSingle")).toHaveLength(0);
  });

  // The scroll region is rendered with role="log" but nothing inside it, and
  // there is no empty state prompting the first message. A newly-confirmed
  // booking opens onto a blank panel.
  it("renders an empty log with no first-message prompt (current behaviour)", async () => {
    await mount([]);
    // The log renders its layout wrapper but nothing inside it: no bubbles, no
    // empty state, no "say hello" prompt - just blank space.
    expect(log().textContent).toBe("");
  });
});

describe("counterparty resolution", () => {
  it("names the sitter when the viewer is the owner", async () => {
    await mount([]);
    expect(screen.getByText(/Jonas Sitter/)).toBeInTheDocument();
  });

  it("names the owner when the viewer is the sitter", async () => {
    h.user = { id: SITTER };
    await mount([]);
    expect(screen.getByText(/Ana Owner/)).toBeInTheDocument();
  });

  it("falls back to the unknown-person key when the counterparty profile is gone", async () => {
    h.bookingResult = { data: bookingRow({ sitter: null }), error: null };
    await mount([]);
    expect(screen.getAllByText(/Someone/).length).toBeGreaterThan(0);
  });

  it("falls back for a whitespace-only name, because the check trims first", async () => {
    // One of only two places in the codebase that trims before falling back;
    // NotificationBell uses ?? and lets "" through.
    h.bookingResult = {
      data: bookingRow({ sitter: party(SITTER, "   ") }),
      error: null,
    };
    await mount([]);
    expect(screen.getAllByText(/Someone/).length).toBeGreaterThan(0);
  });

  it("falls back to the notifications namespace pet key when the booking has no pet", async () => {
    h.bookingResult = { data: bookingRow({ pet: null }), error: null };
    await mount([]);
    expect(
      screen.getByText(/your pet/i),
    ).toBeInTheDocument();
  });

  it("survives a self-booking where the viewer is both owner and sitter", async () => {
    h.bookingResult = {
      data: bookingRow({ owner_id: OWNER, sitter_id: OWNER, sitter: party(OWNER, "Ana Owner") }),
      error: null,
    };
    await expect(mount([messageRow({ sender_id: OWNER })])).resolves.toBeTruthy();
    expect(screen.getByRole("log")).toBeInTheDocument();
  });
});

describe("system rows", () => {
  it("renders a system event row", async () => {
    await mount([
      messageRow({ kind: "system", body: null, event: "accepted", sender_id: SITTER }),
    ]);
    expect(screen.getByText(/confirmed the booking|accepted/i)).toBeInTheDocument();
  });

  // BUG (src/components/MessageThread.tsx): a system row whose event is null
  // returns null from the map - and that early return discards the day divider
  // computed for it. When such a row is the first message of a day, the next
  // message compares its day against the same day and sees no change, so the
  // whole day renders with no date separator at all.
  // Correct behaviour would be to hoist the divider out of the row's own
  // render, or to skip null-event rows before the grouping pass.
  it("swallows the day divider when a null-event system row opens the day (current buggy behaviour)", async () => {
    await mount([
      // Day one, ordinary message.
      messageRow({ body: "day one", created_at: "2026-09-01T10:00:00Z" }),
      // Day two opens with a null-event system row, which renders nothing.
      messageRow({
        kind: "system",
        body: null,
        event: null,
        created_at: "2026-09-02T09:00:00Z",
      }),
      // ...so this message's day looks unchanged and gets no divider.
      messageRow({ body: "day two", created_at: "2026-09-02T10:00:00Z" }),
    ]);

    expect(screen.getByText("day two")).toBeInTheDocument();
    // Dividers are the only pill-shaped spans in the log. Two distinct calendar
    // days are on screen, so there should be two - but the null-event system
    // row swallowed the second one along with itself.
    const dividers = log().querySelectorAll("span.rounded-full");
    expect(dividers).toHaveLength(1);
  });
});

describe("sending", () => {
  it("disables the submit button for an empty draft", async () => {
    await mount([]);
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("disables the submit button for a whitespace-only draft", async () => {
    const user = userEvent.setup();
    await mount([]);
    await user.type(composer(), "   ");
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("inserts the trimmed body and clears the composer", async () => {
    const user = userEvent.setup();
    await mount([]);
    h.insertResult = { data: messageRow({ id: "m-server", body: "hi there" }), error: null };

    await user.type(composer(), "  hi there  ");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(composer()).toHaveValue(""));
    expect(opsMatching("messages.insert")).toEqual([
      {
        op: "messages.insert",
        args: [{ booking_id: "b-1", sender_id: OWNER, kind: "user", body: "hi there" }],
      },
    ]);
  });

  it("shows the message optimistically before the server responds", async () => {
    const user = userEvent.setup();
    await mount([]);
    h.insertResult = { data: messageRow({ id: "m-server", body: "optimistic" }), error: null };

    await user.type(composer(), "optimistic");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getByText("optimistic")).toBeInTheDocument());
  });

  it("rolls the message back and restores the draft when the insert fails", async () => {
    const user = userEvent.setup();
    await mount([]);
    h.insertResult = { data: null, error: { message: "denied" } };

    await user.type(composer(), "will fail");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText(/Message not sent/i)).toBeInTheDocument(),
    );
    // Scoped to the log: the composer itself now holds the restored draft, so
    // an unscoped text query would match that and never fail.
    expect(within(log()).queryByText("will fail")).not.toBeInTheDocument();
    expect(composer()).toHaveValue("will fail");
  });

  it("keeps newly typed text rather than clobbering it with the failed draft", async () => {
    // The restore is setDraft(current => current || body), so it only refills
    // an EMPTY composer. Typing during the in-flight send must win.
    const user = userEvent.setup();
    await mount([]);

    // Hold the insert open so there is a window to type into.
    let failNow!: () => void;
    const gate = new Promise<void>((resolve) => {
      failNow = resolve;
    });
    h.insertGate = gate;
    h.insertResult = { data: null, error: { message: "denied" } };

    await user.type(composer(), "first");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(composer()).toHaveValue(""));

    await user.type(composer(), "second");
    await act(async () => {
      failNow();
      await gate;
    });

    await waitFor(() =>
      expect(screen.getByText(/Message not sent/i)).toBeInTheDocument(),
    );
    expect(composer()).toHaveValue("second");
  });
});

describe("composer key handling", () => {
  it("sends on Enter", async () => {
    const user = userEvent.setup();
    await mount([]);
    h.insertResult = { data: messageRow({ id: "m-server", body: "via enter" }), error: null };

    await user.type(composer(), "via enter");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(opsMatching("messages.insert")).toHaveLength(1));
  });

  it("inserts a newline on Shift+Enter instead of sending", async () => {
    const user = userEvent.setup();
    await mount([]);

    await user.type(composer(), "line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(opsMatching("messages.insert")).toHaveLength(0);
  });

  // Critical for Lithuanian and any IME-driven input: Enter while a composition
  // is active commits the candidate word, it does not send the message.
  it("does not send while an input-method composition is active", async () => {
    const user = userEvent.setup();
    await mount([]);
    await user.type(composer(), "kandidatas");

    fireEvent.keyDown(composer(), {
      key: "Enter",
      isComposing: true,
      // fireEvent reads isComposing off the native event, so set it there too.
      nativeEvent: { isComposing: true },
    });

    expect(opsMatching("messages.insert")).toHaveLength(0);
  });
});

describe("realtime reconciliation", () => {
  it("appends a message that arrives over the channel", async () => {
    await mount([]);
    await act(async () => {
      h.channels[0].emit?.(messageRow({ id: "m-remote", body: "from the other side", sender_id: SITTER }));
    });
    expect(screen.getByText("from the other side")).toBeInTheDocument();
  });

  it("ignores a realtime echo of a message it already holds", async () => {
    await mount([messageRow({ id: "m-1", body: "only once" })]);
    await act(async () => {
      h.channels[0].emit?.(messageRow({ id: "m-1", body: "only once" }));
    });
    expect(screen.getAllByText("only once")).toHaveLength(1);
  });

  it("subscribes on a channel scoped to the booking and removes it on unmount", async () => {
    const { unmount } = await mount([]);
    expect(opsMatching("channel")).toEqual([{ op: "channel", args: ["messages:b-1"] }]);
    unmount();
    expect(opsMatching("removeChannel")).toEqual([
      { op: "removeChannel", args: ["messages:b-1"] },
    ]);
  });

  // BUG (src/components/MessageThread.tsx): the optimistic row is matched by
  // (pending && sender_id && body) with no per-message identity. Two identical
  // messages sent in quick succession produce two indistinguishable pending
  // rows, so the first server echo claims the FIRST pending slot regardless of
  // which send it belongs to - and the second echo then finds no pending match
  // and appends, leaving a duplicate bubble on screen.
  // Correct behaviour would be to carry the optimistic id through the insert
  // and reconcile on that.
  it("cannot tell two identical pending messages apart (current buggy behaviour)", async () => {
    const user = userEvent.setup();
    await mount([]);

    // Send the same text twice. Both inserts resolve to distinct server rows.
    h.insertResult = { data: messageRow({ id: "srv-1", body: "same" }), error: null };
    await user.type(composer(), "same");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getAllByText("same")).toHaveLength(1));

    h.insertResult = { data: messageRow({ id: "srv-2", body: "same" }), error: null };
    await user.type(composer(), "same");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getAllByText("same")).toHaveLength(2));

    // Now a realtime echo for the FIRST server row arrives. It is already
    // present by id, so it is ignored - the safe path.
    await act(async () => {
      h.channels[0].emit?.(messageRow({ id: "srv-1", body: "same" }));
    });
    expect(screen.getAllByText("same")).toHaveLength(2);

    // But an echo for a row the client has never seen, with the same body,
    // claims a pending slot if one is open rather than being matched by id.
    // With no pending rows left it simply appends, producing a third copy.
    await act(async () => {
      h.channels[0].emit?.(messageRow({ id: "srv-3", body: "same" }));
    });
    expect(screen.getAllByText("same")).toHaveLength(3);
  });
});

describe("read receipts", () => {
  it("marks the thread read once the messages have loaded", async () => {
    await mount([messageRow()]);
    await waitFor(() => expect(h.markThreadRead).toHaveBeenCalledWith("b-1"));
  });

  it("does not mark the thread read while the tab is hidden", async () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await mount([messageRow()]);
    expect(h.markThreadRead).not.toHaveBeenCalled();
  });

  it("marks the thread read when the tab becomes visible again", async () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await mount([messageRow()]);
    expect(h.markThreadRead).not.toHaveBeenCalled();

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(h.markThreadRead).toHaveBeenCalledWith("b-1"));
  });

  it("does not mark a failed thread read", async () => {
    h.bookingResult = { data: null, error: { message: "boom" } };
    renderThread();
    await waitFor(() =>
      expect(screen.getByText(/Could not load this conversation/i)).toBeInTheDocument(),
    );
    expect(h.markThreadRead).not.toHaveBeenCalled();
  });
});
