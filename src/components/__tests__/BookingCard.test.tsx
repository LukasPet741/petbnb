import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingCard, { getRelativeLabel } from "@/components/BookingCard";

// BookingCard touches no Supabase and no router - only useLanguage, framer-motion,
// next/link and Avatar. Rendered without a LanguageProvider, the default context's
// t is the identity function, so every label below IS its translation key. That
// makes the assertions precise about which key each state requests.

type Booking = React.ComponentProps<typeof BookingCard>["booking"];

const START = "2026-09-10T09:00:00Z";
const END = "2026-09-12T17:00:00Z";

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    status: "pending",
    service: "walking",
    start_at: START,
    end_at: END,
    notes: null,
    address: null,
    pet: { id: "p-1", name: "Rex", photo_url: null },
    ...overrides,
  };
}

const PROFILE = { full_name: "Jonas Petraitis", avatar_url: null };

function renderCard(props: Partial<React.ComponentProps<typeof BookingCard>> = {}) {
  return render(
    <BookingCard
      booking={booking()}
      isSitterView={false}
      displayProfile={PROFILE}
      displayLabel="with"
      {...props}
    />,
  );
}

const K = {
  cancel: "appPages.bookings.cancelRequestButton",
  accept: "appPages.bookings.acceptButton",
  decline: "appPages.bookings.declineButton",
  markCompleted: "appPages.bookings.markCompletedButton",
  message: "appShell.sidebar.nav.messages",
} as const;

/** The action buttons present, by their translation key. */
function buttonKeys(): string[] {
  return screen.queryAllByRole("button").map((b) => b.textContent?.trim() ?? "");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("state x viewer-role matrix", () => {
  // The single most important contract in this component: which actions each
  // side of the marketplace is offered for a booking in each state. Every row
  // asserts the negative space too, because showing an owner a sitter's Accept
  // button would be a serious bug that a positive-only assertion would miss.

  it("offers an owner only Cancel on a pending booking", () => {
    renderCard({ isSitterView: false, booking: booking({ status: "pending" }) });
    expect(buttonKeys()).toEqual([K.cancel]);
    expect(screen.queryByText(K.accept)).not.toBeInTheDocument();
    expect(screen.queryByText(K.decline)).not.toBeInTheDocument();
    expect(screen.queryByText(K.markCompleted)).not.toBeInTheDocument();
  });

  it("offers a sitter Accept and Decline on a pending booking, in that order", () => {
    renderCard({ isSitterView: true, booking: booking({ status: "pending" }) });
    expect(buttonKeys()).toEqual([K.accept, K.decline]);
    expect(screen.queryByText(K.cancel)).not.toBeInTheDocument();
  });

  it("offers a sitter Mark completed on a signed booking", () => {
    renderCard({ isSitterView: true, booking: booking({ status: "signed" }) });
    expect(buttonKeys()).toEqual([K.markCompleted]);
  });

  it("offers an owner no actions on a signed booking", () => {
    renderCard({ isSitterView: false, booking: booking({ status: "signed" }) });
    expect(buttonKeys()).toEqual([]);
  });

  it.each(["completed", "declined", "cancelled"])(
    "offers a sitter no actions on a %s booking",
    (status) => {
      // Mark-completed is gated on status === "signed" specifically, so a
      // sitter must not be able to re-complete an already-resolved booking.
      renderCard({ isSitterView: true, booking: booking({ status }) });
      expect(buttonKeys()).toEqual([]);
    },
  );

  it.each(["completed", "declined", "cancelled"])(
    "offers an owner no actions on a %s booking",
    (status) => {
      renderCard({ isSitterView: false, booking: booking({ status }) });
      expect(buttonKeys()).toEqual([]);
    },
  );

  it("never offers an owner a sitter-side action in any state", () => {
    for (const status of ["pending", "signed", "completed", "declined", "cancelled"]) {
      const view = render(
        <BookingCard
          booking={booking({ status })}
          isSitterView={false}
          displayProfile={PROFILE}
          displayLabel="with"
        />,
      );
      const keys = buttonKeys();
      expect(keys, `owner saw a sitter action on a ${status} booking`).not.toContain(K.accept);
      expect(keys).not.toContain(K.decline);
      expect(keys).not.toContain(K.markCompleted);
      view.unmount();
    }
  });

  it("never offers a sitter the cancel-request action, which has no sitter equivalent", () => {
    // There is deliberately no sitter-cancel path anywhere in the UI.
    for (const status of ["pending", "signed", "completed", "declined", "cancelled"]) {
      const view = render(
        <BookingCard
          booking={booking({ status })}
          isSitterView
          displayProfile={PROFILE}
          displayLabel="with"
        />,
      );
      expect(buttonKeys()).not.toContain(K.cancel);
      view.unmount();
    }
  });

  it("always offers a message link, even on a cancelled booking", () => {
    renderCard({ booking: booking({ status: "cancelled" }) });
    expect(screen.getByRole("link")).toHaveAttribute("href", "/messages/b-1");
  });

  it("treats an unknown status as resolved and uses the compact layout", () => {
    renderCard({ isSitterView: true, booking: booking({ status: "expired" }) });
    expect(buttonKeys()).toEqual([]);
  });

  // The comparison is case-sensitive, so a differently-cased status silently
  // falls out of the pending branch instead of failing loudly.
  it("does not treat an upper-case PENDING as pending (current behaviour)", () => {
    renderCard({ isSitterView: true, booking: booking({ status: "PENDING" }) });
    expect(buttonKeys()).not.toContain(K.accept);
  });
});

describe("action callbacks", () => {
  it("calls onCancel when an owner cancels", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderCard({ isSitterView: false, onCancel });
    await user.click(screen.getByText(K.cancel));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onAccept and onDecline independently for a sitter", async () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const user = userEvent.setup();
    renderCard({ isSitterView: true, onAccept, onDecline });

    await user.click(screen.getByText(K.accept));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).not.toHaveBeenCalled();

    await user.click(screen.getByText(K.decline));
    expect(onDecline).toHaveBeenCalledOnce();
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it("calls onMarkCompleted from the signed compact row", async () => {
    const onMarkCompleted = vi.fn();
    const user = userEvent.setup();
    renderCard({
      isSitterView: true,
      booking: booking({ status: "signed" }),
      onMarkCompleted,
    });
    await user.click(screen.getByText(K.markCompleted));
    expect(onMarkCompleted).toHaveBeenCalledOnce();
  });

  // Every handler is optional, so a parent that forgets to wire one renders a
  // button that looks live but does nothing. Pinned so a dropped prop in
  // bookings/page.tsx is caught by a test rather than by a user.
  it("renders a dead Accept button when onAccept is omitted (current behaviour)", async () => {
    const user = userEvent.setup();
    renderCard({ isSitterView: true, onAccept: undefined });
    const accept = screen.getByText(K.accept);
    expect(accept).toBeInTheDocument();
    await expect(user.click(accept)).resolves.not.toThrow();
  });
});

describe("photo and avatar fallback", () => {
  it("prefers the pet photo", () => {
    const { container } = render(
      <BookingCard
        booking={booking({ pet: { id: "p", name: "Rex", photo_url: "https://x/pet.jpg" } })}
        isSitterView={false}
        displayProfile={{ full_name: "Jonas", avatar_url: "https://x/person.jpg" }}
        displayLabel="with"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://x/pet.jpg");
  });

  it("falls back to the counterparty avatar when the pet has no photo", () => {
    const { container } = render(
      <BookingCard
        booking={booking({ pet: { id: "p", name: "Rex", photo_url: null } })}
        isSitterView={false}
        displayProfile={{ full_name: "Jonas", avatar_url: "https://x/person.jpg" }}
        displayLabel="with"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://x/person.jpg");
  });

  it("treats an empty pet photo as absent, because the chain uses ||", () => {
    // A ?? chain would have stopped on "" and rendered a broken image.
    const { container } = render(
      <BookingCard
        booking={booking({ pet: { id: "p", name: "Rex", photo_url: "" } })}
        isSitterView={false}
        displayProfile={{ full_name: "Jonas", avatar_url: "https://x/person.jpg" }}
        displayLabel="with"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://x/person.jpg");
  });

  it("uses the counterparty name for the initials, inverting the photo precedence", () => {
    // photo prefers the PET, but the Avatar fallback name prefers the PERSON.
    render(
      <BookingCard
        booking={booking({ status: "signed", pet: { id: "p", name: "Rex", photo_url: null } })}
        isSitterView={false}
        displayProfile={{ full_name: "Jonas Petraitis", avatar_url: null }}
        displayLabel="with"
      />,
    );
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("falls back to the pet name when there is no counterparty profile", () => {
    render(
      <BookingCard
        booking={booking({ status: "signed" })}
        isSitterView={false}
        displayProfile={null}
        displayLabel="with"
      />,
    );
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("falls back to a question mark when there is neither a pet nor a profile", () => {
    render(
      <BookingCard
        booking={booking({ status: "signed", pet: null })}
        isSitterView={false}
        displayProfile={null}
        displayLabel="with"
      />,
    );
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  // BUG: in the compact layout the alt text is the pet name only, so a booking
  // with no pet but a real counterparty photo renders alt="" - the image is
  // announced as decorative even though it is the only visual identifier of
  // the person. The hero layout gets this right, falling back to the name.
  it("renders an empty alt for a counterparty photo with no pet (current buggy behaviour)", () => {
    const { container } = render(
      <BookingCard
        booking={booking({ status: "signed", pet: null })}
        isSitterView={false}
        displayProfile={{ full_name: "Jonas", avatar_url: "https://x/person.jpg" }}
        displayLabel="with"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});

describe("notes and address block", () => {
  it("renders neither section when both are null", () => {
    renderCard({ booking: booking({ notes: null, address: null }) });
    expect(screen.queryByText(/Vilniaus/)).not.toBeInTheDocument();
    expect(screen.queryByText(/quiet dog/)).not.toBeInTheDocument();
  });

  it("renders the address alone", () => {
    renderCard({ booking: booking({ address: "Vilniaus g. 1", notes: null }) });
    expect(screen.getByText("Vilniaus g. 1")).toBeInTheDocument();
  });

  it("renders the notes alone, in typographic quotes", () => {
    renderCard({ booking: booking({ address: null, notes: "quiet dog" })});
    expect(screen.getByText(/quiet dog/)).toBeInTheDocument();
  });

  it("renders both together", () => {
    renderCard({ booking: booking({ address: "Vilniaus g. 1", notes: "quiet dog" }) });
    expect(screen.getByText("Vilniaus g. 1")).toBeInTheDocument();
    expect(screen.getByText(/quiet dog/)).toBeInTheDocument();
  });
});

describe("null pet rendering", () => {
  // BUG: the summary line is `{pet?.name} · {displayLabel} {full_name}`, so a
  // null pet leaves a dangling separator with nothing before it: " · with Jonas".
  it("renders a leading separator when the pet is null (current buggy behaviour)", () => {
    const { container } = render(
      <BookingCard
        booking={booking({ status: "signed", pet: null })}
        isSitterView={false}
        displayProfile={PROFILE}
        displayLabel="with"
      />,
    );
    expect(container.textContent).toContain(" · with Jonas Petraitis");
  });
});

describe("invalid dates", () => {
  // BUG: formatDate has no Invalid-Date guard, so a corrupt start_at throws
  // RangeError out of render. There is no error boundary in this app, so the
  // entire bookings page goes blank rather than one card degrading.
  it("throws out of render for an invalid start_at (current buggy behaviour)", () => {
    expect(() =>
      render(
        <BookingCard
          booking={booking({ status: "signed", start_at: "not-a-date" })}
          isSitterView={false}
          displayProfile={PROFILE}
          displayLabel="with"
        />,
      ),
    ).toThrow(RangeError);
  });
});

describe("getRelativeLabel", () => {
  const t = (key: string, vars?: Record<string, string | number>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key;

  const at = (now: string, startAt: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    return getRelativeLabel(startAt, t);
  };

  it("returns null for a booking that already started", () => {
    // A countdown to the past makes no sense, so the chip is omitted entirely.
    expect(at("2026-09-10T12:00:00Z", "2026-09-09T09:00:00Z")).toBeNull();
  });

  it("says today for a start earlier the same local day", () => {
    expect(at("2026-09-10T20:00:00Z", "2026-09-10T06:00:00Z")).toBe(
      "appPages.bookings.relativeToday",
    );
  });

  it("says tomorrow for the next local day", () => {
    expect(at("2026-09-10T12:00:00Z", "2026-09-11T06:00:00Z")).toBe(
      "appPages.bookings.relativeTomorrow",
    );
  });

  it("counts whole days beyond tomorrow", () => {
    expect(at("2026-09-10T12:00:00Z", "2026-09-15T06:00:00Z")).toBe(
      'appPages.bookings.relativeInDays:{"days":5}',
    );
  });

  it("says tomorrow across a local midnight only an hour away", () => {
    // 23:59 local today vs 00:01 local tomorrow is one calendar day, not zero.
    // 20:59Z is 23:59 Vilnius; 21:01Z is 00:01 the next local day.
    expect(at("2026-09-10T20:59:00Z", "2026-09-10T21:01:00Z")).toBe(
      "appPages.bookings.relativeTomorrow",
    );
  });

  it("stays correct across the March DST jump, where the day is only 23 hours", () => {
    // Math.round (rather than floor) is what makes this survive a short day.
    expect(at("2026-03-28T12:00:00Z", "2026-03-29T12:00:00Z")).toBe(
      "appPages.bookings.relativeTomorrow",
    );
  });

  it("stays correct across the October DST fallback, where the day is 25 hours", () => {
    expect(at("2026-10-24T12:00:00Z", "2026-10-25T12:00:00Z")).toBe(
      "appPages.bookings.relativeTomorrow",
    );
  });

  it("counts correctly across a year boundary", () => {
    expect(at("2026-12-31T12:00:00Z", "2027-01-01T12:00:00Z")).toBe(
      "appPages.bookings.relativeTomorrow",
    );
  });

  // BUG: no Invalid-Date guard. new Date(NaN, NaN, NaN) is invalid, the day
  // difference is NaN, every comparison is false, and the user is shown
  // "in NaN days". Same root cause as the timeAgo NaN bug in lib/utils.
  it("renders a NaN day count for an invalid start_at (current buggy behaviour)", () => {
    expect(at("2026-09-10T12:00:00Z", "garbage")).toBe(
      'appPages.bookings.relativeInDays:{"days":null}',
    );
  });
});
