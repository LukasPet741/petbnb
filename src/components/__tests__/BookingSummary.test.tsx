import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BookingSummary from "@/components/BookingSummary";
import type { Profile } from "@/lib/types";

/**
 * The live summary beside the booking form.
 *
 * Like the review components it renders without a LanguageProvider, so `t` is the
 * identity function and every visible label is the translation key it asked for.
 * That is why assertions below look for "appPages.bookingsNew.summaryNotChosen"
 * rather than "Not chosen yet".
 *
 * It owns no data access: the page hands it a sitter, a service and two date strings.
 * The whole point is that it renders sensibly while the form is still half empty,
 * which is its state for most of the time a user spends on the page.
 */

const sitter = {
  id: "s1",
  full_name: "Simona Barauskaitė",
  city: "Vilnius",
  is_sitter: true,
  rate_per_hour: 20,
  experience_years: 3,
  services: { walking: true, boarding: true, daycare: false, grooming: false },
  about_me: null,
  avatar_url: null,
  last_active_at: "2026-09-13T10:00:00Z",
} as Profile;

const NOT_CHOSEN = "appPages.bookingsNew.summaryNotChosen";

function renderSummary(props: Partial<React.ComponentProps<typeof BookingSummary>> = {}) {
  return render(
    <BookingSummary sitter={sitter} service="" startAt="" endAt="" {...props} />,
  );
}

describe("BookingSummary", () => {
  it("names the sitter it is summarising", () => {
    renderSummary();
    expect(screen.getByText("Simona Barauskaitė")).toBeInTheDocument();
  });

  it("says nothing is chosen yet while the form is empty", () => {
    // Its opening state, and the one a user looks at longest.
    renderSummary();
    expect(screen.getAllByText(NOT_CHOSEN).length).toBeGreaterThan(0);
  });

  it("shows the chosen service once one is picked", () => {
    renderSummary({ service: "boarding" });
    expect(screen.getByText("common.services.boarding")).toBeInTheDocument();
  });

  it("shows a duration and an estimate once both dates are filled", () => {
    renderSummary({ service: "walking", startAt: "2026-09-14T09:00", endAt: "2026-09-14T12:00" });
    expect(screen.getByText("appPages.bookingsNew.summaryDurationHours")).toBeInTheDocument();
    // 3h at €20 = €60, formatted through formatCurrency.
    expect(screen.getByText(/60/)).toBeInTheDocument();
  });

  it("shows no estimate while only one date is filled", () => {
    // Half-filled is the normal case, not an edge case: the summary must not flash a
    // price computed from one date.
    renderSummary({ service: "walking", startAt: "2026-09-14T09:00" });
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });

  it("shows no estimate when the range is reversed", () => {
    // Typing the end before the start is ordinary. A negative price must never render.
    renderSummary({ service: "walking", startAt: "2026-09-14T12:00", endAt: "2026-09-14T09:00" });
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });

  it("shows no estimate when the sitter has no rate, even with valid dates", () => {
    // rate_per_hour is nullable. "Cannot say" must not render as €0.
    renderSummary({
      sitter: { ...sitter, rate_per_hour: null } as Profile,
      service: "walking",
      startAt: "2026-09-14T09:00",
      endAt: "2026-09-14T12:00",
    });
    expect(screen.queryByText(/€0/)).not.toBeInTheDocument();
  });

  it("prints the date once for a booking that starts and ends on the same day", () => {
    // "14 Sept 2026 09:00 → 14 Sept 2026 12:00" wraps into ragged lines in a 20rem
    // column. A same-day walk needs the date once and a time range.
    const { container } = renderSummary({ startAt: "2026-09-14T09:00", endAt: "2026-09-14T12:00" });
    expect(container.textContent?.match(/2026/g)?.length).toBe(1);
  });

  it("prints both dates for a booking spanning days", () => {
    const { container } = renderSummary({ startAt: "2026-09-14T09:00", endAt: "2026-09-16T09:00" });
    expect(container.textContent?.match(/2026/g)?.length).toBe(2);
  });

  it("flags a reversed range instead of calling the duration not chosen", () => {
    // Both dates ARE chosen. "Not chosen yet" was simply untrue here.
    renderSummary({ service: "walking", startAt: "2026-09-14T12:00", endAt: "2026-09-14T09:00" });
    expect(screen.getByText("appPages.bookingsNew.summaryInvalidRange")).toBeInTheDocument();
  });

  it("never claims the dates are unchosen once both are filled", () => {
    // A reversed range, and a sitter with no rate, both leave the estimate unknown —
    // but neither is "not chosen yet". Unknown gets a dash.
    renderSummary({ service: "walking", startAt: "2026-09-14T12:00", endAt: "2026-09-14T09:00" });
    expect(screen.queryByText(NOT_CHOSEN)).not.toBeInTheDocument();
  });

  it("shows a dash, not 'not chosen', when the sitter has no rate", () => {
    renderSummary({
      sitter: { ...sitter, rate_per_hour: null } as Profile,
      service: "walking",
      startAt: "2026-09-14T09:00",
      endAt: "2026-09-14T12:00",
    });
    expect(screen.queryByText(NOT_CHOSEN)).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders without a sitter at all", () => {
    // /bookings/new is reachable with no ?sitter= in the URL.
    render(<BookingSummary sitter={null} service="" startAt="" endAt="" />);
    expect(screen.getByText("appPages.bookingsNew.summaryTitle")).toBeInTheDocument();
  });
});
