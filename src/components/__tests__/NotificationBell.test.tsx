import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import NotificationBell from "@/components/NotificationBell";
import { LanguageProvider } from "@/context/LanguageContext";
import type {
  AppNotification,
  Booking,
  NotificationType,
  Pet,
  Profile,
  ServiceType,
} from "@/lib/types";

// NotificationBell documents that it never touches Supabase - the provider owns the
// query, the realtime channel and the read-marking RPCs. So only the notifications
// and language contexts are mocked here. @/lib/supabase is still stubbed because the
// real LanguageProvider (used by the sentence tests, where translated output matters)
// subscribes to auth on mount.
//
// Rendered WITHOUT a LanguageProvider the default context's `t` is the identity
// function, so most assertions below read as translation keys - which is the point:
// they pin exactly which key each state requests.

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

// framer-motion is replaced by DOM-transparent stubs so that (a) the exit animation
// on the panel resolves immediately - otherwise "the panel closed" is unassertable -
// and (b) the `variants` object reaches the DOM as an attribute, which is the only
// way to observe the list stagger the component picks.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  type MotionProps = Record<string, unknown> & { children?: ReactNode };
  const make = (tag: string) =>
    function MotionStub({
      children,
      variants,
      initial,
      animate,
      exit,
      transition,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      layout,
      layoutId,
      ...rest
    }: MotionProps) {
      return React.createElement(
        tag,
        {
          ...rest,
          "data-variants": variants ? JSON.stringify(variants) : undefined,
        },
        children,
      );
    };
  const cache = new Map<string, unknown>();
  const motion = new Proxy(
    {},
    {
      get(_target, prop) {
        const tag = String(prop);
        if (!cache.has(tag)) cache.set(tag, make(tag));
        return cache.get(tag);
      },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

type NotificationsValue = {
  notifications: AppNotification[];
  unreadCount: number;
  unreadByBooking: Record<string, number>;
  loading: boolean;
  markAllRead: ReturnType<typeof vi.fn>;
  markRead: ReturnType<typeof vi.fn>;
  markThreadRead: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
};

const ctx = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ctx.value,
}));

/** Mirrors the real context's defaults: loading, with nothing loaded yet. */
function setContext(overrides: Partial<NotificationsValue> = {}): NotificationsValue {
  const value: NotificationsValue = {
    notifications: [],
    unreadCount: 0,
    unreadByBooking: {},
    loading: true,
    markAllRead: vi.fn(async () => {}),
    markRead: vi.fn(async () => {}),
    markThreadRead: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    ...overrides,
  };
  ctx.value = value;
  return value;
}

// ---------------------------------------------------------------- fixtures

const PET: Pet = {
  id: "p-1",
  owner_id: "u-1",
  name: "Rex",
  type: "dog",
  sex: "male",
  weight_kg: 12,
  bio: null,
  photo_url: null,
  created_at: "2026-01-01T00:00:00Z",
};

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "a-1",
    full_name: "Jonas Petraitis",
    phone: "+37060000000",
    city: "Vilnius",
    is_sitter: true,
    rate_per_hour: 12,
    experience_years: 3,
    services: { walking: true, boarding: false, daycare: false, grooming: false },
    about_me: null,
    avatar_url: null,
    last_active_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    owner_id: "u-1",
    sitter_id: "a-1",
    pet_id: "p-1",
    service: "walking" as ServiceType,
    start_at: "2026-09-10T09:00:00Z",
    end_at: "2026-09-10T11:00:00Z",
    address: null,
    notes: null,
    status: "pending",
    created_at: "2026-01-01T00:00:00Z",
    pet: PET,
    ...overrides,
  };
}

function notif(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n-1",
    user_id: "u-1",
    actor_id: "a-1",
    booking_id: "b-1",
    type: "message_received",
    read_at: null,
    created_at: new Date().toISOString(),
    email_status: "sent",
    email_error: null,
    actor: profile(),
    booking: booking(),
    ...overrides,
  };
}

const K = {
  bell: "messages.notifications.bellAriaLabel",
  bellUnread: "messages.notifications.bellAriaLabelUnread",
  title: "messages.notifications.title",
  markAllRead: "messages.notifications.markAllRead",
  empty: "messages.notifications.empty",
  emptyHint: "messages.notifications.emptyHint",
  viewAll: "messages.notifications.viewAll",
  justNow: "common.timeAgo.justNow",
} as const;

// ---------------------------------------------------------------- helpers

function trigger(): HTMLButtonElement {
  return screen.getByRole("button", { name: /bellAriaLabel/ }) as HTMLButtonElement;
}

function panel(): HTMLElement {
  return screen.getByRole("dialog");
}

/** Opens the popover and returns it. */
async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("button")[0]);
  return panel();
}

/**
 * Row wrappers, in render order. Each row is a `motion.div` nested inside the
 * list's own `motion.div`, so both carry the stub's data-variants attribute.
 */
function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-variants] [data-variants]"),
  );
}

/** The clickable row element: an <a> when booking_id is set, a <div> otherwise. */
function rowBody(row: HTMLElement): HTMLElement {
  const el = row.firstElementChild;
  if (!(el instanceof HTMLElement)) throw new Error("expected a row body");
  return el;
}

/** Raw (un-normalised) sentence text of the nth row - doubled spaces preserved. */
function rawSentence(container: HTMLElement, index = 0): string {
  const p = rows(container)[index].querySelector("p");
  if (!p) throw new Error("expected a sentence paragraph");
  return p.textContent ?? "";
}

function renderBell(props: { align?: "left" | "right" } = {}) {
  return render(<NotificationBell {...props} />);
}

/** For the sentence tests, where real translated copy is the thing under test. */
function renderTranslated(locale: "en" | "lt", props: { align?: "left" | "right" } = {}) {
  window.localStorage.setItem("petbnb-locale", locale);
  return render(
    <LanguageProvider>
      <NotificationBell {...props} />
    </LanguageProvider>,
  );
}

// Panel rows and the view-all control are real next/link anchors. jsdom has no
// navigation, so letting a click run its default action prints a "Not
// implemented: navigation" error into the test output. Cancelling the default
// keeps the output clean without weakening anything: no assertion here depends
// on navigation actually happening, only on the panel's own reaction to the
// click.
const swallowNavigation = (e: MouseEvent) => {
  if ((e.target as HTMLElement | null)?.closest?.("a[href]")) e.preventDefault();
};

beforeEach(() => {
  window.localStorage.clear();
  setContext();
  document.addEventListener("click", swallowNavigation);
});

afterEach(() => {
  document.removeEventListener("click", swallowNavigation);
  vi.useRealTimers();
});

// ---------------------------------------------------------------- badge

describe("unread badge", () => {
  it("renders no badge at all when the unread count is zero", () => {
    setContext({ unreadCount: 0 });
    const { container } = renderBell();
    // The badge is the only aria-hidden span inside the trigger.
    expect(container.querySelector("button span[aria-hidden]")).toBeNull();
  });

  it.each([
    [1, "1"],
    [9, "9"],
    [10, "9+"],
    [99, "9+"],
    [1000, "9+"],
  ])("renders %s unread as %s", (count, expected) => {
    setContext({ unreadCount: count });
    const { container } = renderBell();
    expect(container.querySelector("button span[aria-hidden]")).toHaveTextContent(
      expected,
    );
  });

  it("never renders a 99+ form - anything over nine collapses to 9+", () => {
    setContext({ unreadCount: 99 });
    const { container } = renderBell();
    const badge = container.querySelector("button span[aria-hidden]");
    expect(badge?.textContent).toBe("9+");
    expect(badge?.textContent).not.toBe("99+");
  });

  it("reports the TRUE count in the aria-label while the badge shows 9+", () => {
    // Deliberate disagreement between the visual badge and the accessible name:
    // the badge is capped and aria-hidden, the label is uncapped. Pinned so a
    // future "cap the aria-label too" change has to be a deliberate one.
    setContext({ unreadCount: 137 });
    const { container } = renderTranslated("en");
    expect(container.querySelector("button span[aria-hidden]")).toHaveTextContent("9+");
    expect(
      screen.getByRole("button", { name: "Notifications, 137 unread" }),
    ).toBeInTheDocument();
  });

  it("labels the trigger with the plain key when nothing is unread", () => {
    setContext({ unreadCount: 0 });
    renderBell();
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", K.bell);
  });

  it("labels the trigger with the unread key when something is unread", () => {
    setContext({ unreadCount: 3 });
    renderBell();
    // The identity `t` drops the {count} var, so the key itself is the label.
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", K.bellUnread);
  });
});

// ---------------------------------------------------------------- panel body

describe("panel body states", () => {
  it("is closed until the trigger is clicked", () => {
    renderBell();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the trigger expanded while the panel is open", async () => {
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("renders three aria-hidden skeleton rows while loading with nothing loaded", async () => {
    const user = userEvent.setup();
    setContext({ loading: true, notifications: [] });
    const { container } = renderBell();
    await openPanel(user);
    const skeleton = container.querySelector('[role="dialog"] > div[aria-hidden="true"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.children).toHaveLength(3);
    expect(screen.queryByText(K.empty)).not.toBeInTheDocument();
  });

  it("shows the skeleton by default, because the context defaults to loading with an empty list", async () => {
    const user = userEvent.setup();
    const { container } = renderBell();
    await openPanel(user);
    expect(
      container.querySelector('[role="dialog"] > div[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it("shows the empty message and its hint once loading finishes with no rows", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [] });
    const { container } = renderBell();
    await openPanel(user);
    expect(screen.getByText(K.empty)).toBeInTheDocument();
    expect(screen.getByText(K.emptyHint)).toBeInTheDocument();
    expect(
      container.querySelector('[role="dialog"] > div[aria-hidden="true"]'),
    ).toBeNull();
  });

  it("renders the list, not the skeleton, when rows are already loaded but loading is still true", async () => {
    // The skeleton branch requires BOTH loading and an empty list: a background
    // refresh must not blank out rows the user is already reading.
    const user = userEvent.setup();
    setContext({ loading: true, notifications: [notif()] });
    const { container } = renderBell();
    await openPanel(user);
    expect(rows(container)).toHaveLength(1);
    expect(
      container.querySelector('[role="dialog"] > div[aria-hidden="true"]'),
    ).toBeNull();
    expect(screen.queryByText(K.empty)).not.toBeInTheDocument();
  });

  it("renders the list and neither of the other two states once loaded", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [notif(), notif({ id: "n-2" })] });
    const { container } = renderBell();
    await openPanel(user);
    expect(rows(container)).toHaveLength(2);
    expect(screen.queryByText(K.empty)).not.toBeInTheDocument();
    expect(
      container.querySelector('[role="dialog"] > div[aria-hidden="true"]'),
    ).toBeNull();
  });

  it("always renders the title and the view-all link, whatever the body state", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [] });
    renderBell();
    await openPanel(user);
    expect(within(panel()).getByRole("heading", { name: K.title })).toBeInTheDocument();
    expect(within(panel()).getByRole("link", { name: K.viewAll })).toHaveAttribute(
      "href",
      "/messages",
    );
  });

  it("labels the dialog with the id of its own heading", async () => {
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);
    const heading = within(panel()).getByRole("heading", { name: K.title });
    expect(panel()).toHaveAttribute("aria-labelledby", heading.id);
    expect(heading.id).not.toBe("");
  });
});

describe("mark-all-read affordance", () => {
  it("is absent when nothing is unread", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, unreadCount: 0, notifications: [notif({ read_at: "2026-01-01T00:00:00Z" })] });
    renderBell();
    await openPanel(user);
    expect(screen.queryByText(K.markAllRead)).not.toBeInTheDocument();
  });

  it("calls markAllRead when the unread count is above zero", async () => {
    const user = userEvent.setup();
    const value = setContext({ loading: false, unreadCount: 2, notifications: [notif()] });
    renderBell();
    await openPanel(user);
    await user.click(screen.getByText(K.markAllRead));
    expect(value.markAllRead).toHaveBeenCalledTimes(1);
    // The panel stays open: marking read is not a dismissal.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // The real provider derives unreadCount from `notifications`, so this pairing is
  // unreachable in production - but nothing in the component enforces it. The badge
  // and the mark-all-read button say "you have 4 unread" while the body says
  // "you're all caught up". Pinned because it is the honest current behaviour;
  // correct behaviour would be to derive the badge from the same list the body renders.
  it("shows a badge and mark-all-read next to the empty state when the count disagrees with the list (contradictory, current behaviour)", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, unreadCount: 4, notifications: [] });
    const { container } = renderBell();
    expect(container.querySelector("button span[aria-hidden]")).toHaveTextContent("4");
    await openPanel(user);
    expect(screen.getByText(K.markAllRead)).toBeInTheDocument();
    expect(screen.getByText(K.empty)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- sentences

const TYPES: NotificationType[] = [
  "booking_requested",
  "booking_accepted",
  "booking_declined",
  "booking_cancelled",
  "booking_completed",
  "message_received",
];

describe("sentence building", () => {
  it.each([
    ["booking_requested", "Jonas Petraitis requested Dog Walking for Rex"],
    ["booking_accepted", "Jonas Petraitis confirmed your booking for Rex"],
    ["booking_declined", "Jonas Petraitis declined your request for Rex"],
    ["booking_cancelled", "Jonas Petraitis cancelled the booking for Rex"],
    ["booking_completed", "Jonas Petraitis marked Rex's booking as completed"],
    ["message_received", "Jonas Petraitis sent you a message"],
  ])("builds the English sentence for %s from the joined actor, pet and booking", async (type, expected) => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ type: type as NotificationType })],
    });
    const { container } = renderTranslated("en");
    await openPanel(user);
    expect(rawSentence(container)).toBe(expected);
  });

  it.each(TYPES)("falls back to the unknown-person copy for %s when the actor join is missing", async (type) => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [notif({ type, actor: undefined })] });
    const { container } = renderTranslated("en");
    await openPanel(user);
    expect(rawSentence(container).startsWith("Someone ")).toBe(true);
    expect(rawSentence(container)).not.toContain("Jonas");
  });

  it.each(TYPES)("falls back to the generic pet copy for %s when the pet join is missing", async (type) => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ type, booking: booking({ pet: undefined }) })],
    });
    const { container } = renderTranslated("en");
    await openPanel(user);
    const text = rawSentence(container);
    expect(text).not.toContain("Rex");
    // message_received interpolates neither {pet} nor {service}.
    if (type !== "message_received") expect(text).toContain("your pet");
  });

  it.each(TYPES)("falls back to the generic pet copy for %s when the whole booking join is missing", async (type) => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [notif({ type, booking: undefined })] });
    const { container } = renderTranslated("en");
    await openPanel(user);
    const text = rawSentence(container);
    expect(text).not.toContain("Rex");
    expect(text).not.toContain("{"); // no raw placeholder ever leaks
    if (type !== "message_received") expect(text).toContain("your pet");
  });

  // BUG: actorName uses `n.actor?.full_name ?? t("messages.unknownPerson")`. Nullish
  // coalescing only catches null/undefined, so an actor row whose full_name is the
  // empty string renders as an empty actor and the sentence gains a LEADING SPACE
  // (" sent you a message"). MessageThread guards the same field correctly with
  // `full_name?.trim() || t("messages.unknownPerson")`, so the two screens disagree
  // about the same profile. Correct behaviour here would be the trim-then-|| form.
  // src/components/NotificationBell.tsx:48 vs src/components/MessageThread.tsx:218.
  it("renders a leading space instead of the unknown-person fallback for an empty actor name (current buggy behaviour)", async () => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ actor: profile({ full_name: "" }) })],
    });
    const { container } = renderTranslated("en");
    await openPanel(user);
    // Read raw text: toHaveTextContent would normalise the leading space away.
    expect(rawSentence(container)).toBe(" sent you a message");
    expect(rawSentence(container)).not.toContain("Someone");
  });

  it("also renders a leading space for a whitespace-only actor name (current buggy behaviour)", async () => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ actor: profile({ full_name: "   " }) })],
    });
    const { container } = renderTranslated("en");
    await openPanel(user);
    expect(rawSentence(container)).toBe("    sent you a message");
  });

  // BUG: booking_requested is the only type that interpolates {service}, and without
  // the booking join `service` is deliberately set to "" rather than a raw key. That
  // leaves a DOUBLE SPACE mid-sentence in both locales: "requested  for your pet".
  // Correct behaviour would be a service-less variant of the string per locale.
  // src/components/NotificationBell.tsx:58.
  it("renders a doubled space in the English booking_requested sentence when the booking join is missing (current buggy behaviour)", async () => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ type: "booking_requested", booking: undefined })],
    });
    const { container } = renderTranslated("en");
    await openPanel(user);
    // container.textContent, not toHaveTextContent: the latter collapses whitespace
    // and would report this sentence as perfectly fine.
    expect(rawSentence(container)).toBe("Jonas Petraitis requested  for your pet");
    expect(rawSentence(container)).toContain("  ");
  });

  it("renders a doubled space in the Lithuanian booking_requested sentence when the booking join is missing (current buggy behaviour)", async () => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ type: "booking_requested", booking: undefined })],
    });
    const { container } = renderTranslated("lt");
    await openPanel(user);
    expect(rawSentence(container)).toBe(
      "Jonas Petraitis pateikė  užklausą augintiniui jūsų augintinis",
    );
  });

  it("builds the Lithuanian booking_requested sentence with the localised service name when the booking is joined", async () => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ type: "booking_requested" })],
    });
    const { container } = renderTranslated("lt");
    await openPanel(user);
    expect(rawSentence(container)).toBe(
      "Jonas Petraitis pateikė Šunų vedžiojimas užklausą augintiniui Rex",
    );
  });
});

// ---------------------------------------------------------------- rows

describe("row rendering", () => {
  it("renders a row with a booking id as a link to that thread", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [notif({ booking_id: "b-42" })] });
    const { container } = renderBell();
    await openPanel(user);
    expect(rowBody(rows(container)[0]).tagName).toBe("A");
    expect(rowBody(rows(container)[0])).toHaveAttribute("href", "/messages/b-42");
  });

  it("renders a row with no booking id as a plain, unfocusable div", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [notif({ booking_id: null })] });
    const { container } = renderBell();
    await openPanel(user);
    const body = rowBody(rows(container)[0]);
    expect(body.tagName).toBe("DIV");
    expect(body).not.toHaveAttribute("href");
    expect(body).not.toHaveAttribute("tabindex");
    // Tab from the trigger reaches the view-all link, never the row.
    body.focus();
    expect(document.activeElement).not.toBe(body);
  });

  it("never calls markRead for an unread row that has no booking id, because it is not clickable", async () => {
    const user = userEvent.setup();
    const value = setContext({
      loading: false,
      notifications: [notif({ booking_id: null, read_at: null })],
    });
    const { container } = renderBell();
    await openPanel(user);
    await user.click(rowBody(rows(container)[0]));
    expect(value.markRead).not.toHaveBeenCalled();
    // And the row does not dismiss the panel either.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an unread dot and the highlighted background while read_at is absent", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [notif({ read_at: null })] });
    const { container } = renderBell();
    await openPanel(user);
    const body = rowBody(rows(container)[0]);
    expect(body.classList.contains("bg-brand-softer")).toBe(true);
    expect(body.querySelector('span[aria-hidden="true"].bg-brand')).not.toBeNull();
  });

  it("drops the dot and the highlight once read_at is set", async () => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ read_at: "2026-08-30T10:00:00Z" })],
    });
    const { container } = renderBell();
    await openPanel(user);
    const body = rowBody(rows(container)[0]);
    // Only the hover variant survives, not the resting highlight.
    expect(body.classList.contains("bg-brand-softer")).toBe(false);
    expect(body.classList.contains("hover:bg-brand-softer")).toBe(true);
    expect(body.querySelector('span[aria-hidden="true"].bg-brand')).toBeNull();
  });

  it("renders a relative timestamp under each sentence", async () => {
    const user = userEvent.setup();
    setContext({
      loading: false,
      notifications: [notif({ created_at: new Date(Date.now() - 5 * 60_000).toISOString() })],
    });
    renderBell();
    await openPanel(user);
    expect(screen.getByText("common.timeAgo.minutesAgo")).toBeInTheDocument();
  });

  it("clamps a created_at in the future to the just-now copy", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [notif({ created_at: "2099-01-01T00:00:00Z" })] });
    renderBell();
    await openPanel(user);
    // timeAgo floors the elapsed seconds at 0, so a clock-skewed row never says
    // "-52560000m ago".
    expect(screen.getByText(K.justNow)).toBeInTheDocument();
  });

  it("labels the row avatar with the same actor name the sentence uses", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: [notif({ actor: undefined })] });
    const { container } = renderTranslated("en");
    await openPanel(user);
    // Avatar renders initials from the resolved name: "Someone" -> "S".
    expect(rows(container)[0].textContent?.startsWith("S")).toBe(true);
  });
});

describe("opening a row", () => {
  it("marks exactly that one row read when it is unread, and closes the panel", async () => {
    const user = userEvent.setup();
    const value = setContext({
      loading: false,
      notifications: [notif({ id: "n-1", read_at: null }), notif({ id: "n-2", read_at: null })],
    });
    const { container } = renderBell();
    await openPanel(user);
    await user.click(rowBody(rows(container)[1]));
    expect(value.markRead).toHaveBeenCalledTimes(1);
    expect(value.markRead).toHaveBeenCalledWith(["n-2"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not call markRead for a row that is already read, but still closes the panel", async () => {
    const user = userEvent.setup();
    const value = setContext({
      loading: false,
      notifications: [notif({ id: "n-1", read_at: "2026-08-30T10:00:00Z" })],
    });
    const { container } = renderBell();
    await openPanel(user);
    await user.click(rowBody(rows(container)[0]));
    expect(value.markRead).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the panel from the view-all link without marking anything read", async () => {
    const user = userEvent.setup();
    const value = setContext({ loading: false, notifications: [notif()] });
    renderBell();
    await openPanel(user);
    await user.click(screen.getByRole("link", { name: K.viewAll }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(value.markRead).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- dismissal

describe("dismissal", () => {
  it("closes on a mousedown outside the component", async () => {
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);
    await user.click(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays open on a click inside the panel", async () => {
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);
    await user.click(within(panel()).getByRole("heading", { name: K.title }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("toggles closed when the trigger itself is clicked again", async () => {
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);
    await user.click(trigger());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderBell();
    const button = trigger();
    await openPanel(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(button);
  });

  it("leaves the panel open for keys other than Escape", async () => {
    // The document keydown handler returns early for anything but Escape.
    // Note this must not use Enter or Space: focus sits on the trigger after
    // opening, so those would activate the button and toggle the panel shut -
    // which is the button behaving correctly, not the keydown handler firing.
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);
    await user.keyboard("a");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("attaches the document listeners only while open, and removes both on close", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const countOf = (spy: typeof add, type: string) =>
      spy.mock.calls.filter((c) => c[0] === type).length;

    const user = userEvent.setup();
    renderBell();
    // Closed: nothing global is listening, so a bell on every page costs nothing.
    expect(countOf(add, "mousedown")).toBe(0);
    expect(countOf(add, "keydown")).toBe(0);

    await openPanel(user);
    expect(countOf(add, "mousedown")).toBe(1);
    expect(countOf(add, "keydown")).toBe(1);
    expect(countOf(remove, "mousedown")).toBe(0);

    await user.keyboard("{Escape}");
    expect(countOf(remove, "mousedown")).toBe(1);
    expect(countOf(remove, "keydown")).toBe(1);
    expect(countOf(add, "mousedown")).toBe(1);
  });

  it("removes the document listeners when the bell unmounts while open", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const user = userEvent.setup();
    const { unmount } = renderBell();
    await openPanel(user);
    unmount();
    expect(remove.mock.calls.filter((c) => c[0] === "mousedown")).toHaveLength(1);
    expect(remove.mock.calls.filter((c) => c[0] === "keydown")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- layout

describe("list stagger", () => {
  const staggerOf = (container: HTMLElement): number => {
    const list = container.querySelector<HTMLElement>('[role="dialog"] [data-variants]');
    const raw = list?.getAttribute("data-variants");
    if (!raw) throw new Error("expected list variants");
    return (JSON.parse(raw) as { show: { transition: { staggerChildren: number } } }).show
      .transition.staggerChildren;
  };

  const many = (count: number) =>
    Array.from({ length: count }, (_, i) => notif({ id: `n-${i}` }));

  it("uses the roomy stagger at exactly twelve rows", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: many(12) });
    const { container } = renderBell();
    await openPanel(user);
    expect(staggerOf(container)).toBe(0.05);
  });

  it("switches to the flatter stagger at thirteen rows", async () => {
    const user = userEvent.setup();
    setContext({ loading: false, notifications: many(13) });
    const { container } = renderBell();
    await openPanel(user);
    expect(staggerOf(container)).toBe(0.012);
  });
});

describe("alignment", () => {
  it("hangs the panel from the right edge by default", async () => {
    const user = userEvent.setup();
    renderBell();
    const el = await openPanel(user);
    expect(el.classList.contains("right-0")).toBe(true);
    expect(el.classList.contains("left-0")).toBe(false);
    expect(el.style.transformOrigin).toBe("top right");
  });

  it('hangs the panel from the left edge when align is "left"', async () => {
    const user = userEvent.setup();
    renderBell({ align: "left" });
    const el = await openPanel(user);
    expect(el.classList.contains("left-0")).toBe(true);
    expect(el.classList.contains("right-0")).toBe(false);
    expect(el.style.transformOrigin).toBe("top left");
  });

  it('matches the default when align is explicitly "right"', async () => {
    const user = userEvent.setup();
    renderBell({ align: "right" });
    const el = await openPanel(user);
    expect(el.classList.contains("right-0")).toBe(true);
    expect(el.style.transformOrigin).toBe("top right");
  });
});
