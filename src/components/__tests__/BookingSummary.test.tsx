import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BookingSummary from "@/components/BookingSummary";
import type { Profile } from "@/lib/types";

/**
 * The live summary beside the booking form.
 *
 * Like the review components it renders without a LanguageProvider, so `t` is the
 * identity function and every visible label is the translation key it asked for.
 *
 * It owns no data access: the page hands it a sitter, a service, two date strings and the
 * owner's offer. It renders sensibly while the form is still half empty, which is its state
 * for most of the time a user spends on the page. Since 2026-09-15 it shows the stay in days
 * and the asking price from the sitter's per-period prices; the real price is agreed in chat.
 */

const sitter = {
  id: "s1",
  full_name: "Simona Barauskaitė",
  city: "Vilnius",
  is_sitter: true,
  rate_per_hour: null,
  experience_years: 3,
  services: { walking: true, boarding: true, daycare: false, grooming: false },
  prices: { walking: { amount: 10, days: 1 }, boarding: { amount: 75, days: 3 } },
  about_me: null,
  avatar_url: null,
  last_active_at: "2026-09-13T10:00:00Z",
} as Profile;

const NOT_CHOSEN = "appPages.bookingsNew.summaryNotChosen";

/** The value beside the asking-price label. The sitter price row also shows euros. */
const askingValue = () => screen.getByText("appPages.bookingsNew.summaryEstimateLabel").nextElementSibling as HTMLElement;

function renderSummary(props: Partial<React.ComponentProps<typeof BookingSummary>> = {}) {
  return render(<BookingSummary sitter={sitter} service="" startAt="" endAt="" {...props} />);
}

describe("BookingSummary", () => {
  it("names the sitter it is summarising", () => {
    renderSummary();
    expect(screen.getByText("Simona Barauskaitė")).toBeInTheDocument();
  });

  it("says nothing is chosen yet while the form is empty", () => {
    renderSummary();
    expect(screen.getAllByText(NOT_CHOSEN).length).toBeGreaterThan(0);
  });

  it("shows the chosen service once one is picked", () => {
    renderSummary({ service: "boarding" });
    expect(screen.getByText("common.services.boarding")).toBeInTheDocument();
  });

  it("counts the stay in 24-hour days and stretches the price for a longer stay", () => {
    // Mon 09:00 → Wed 18:00 is 57 hours: 3 days, 3 × 10 € = 30 €.
    renderSummary({ service: "walking", startAt: "2026-09-14T09:00", endAt: "2026-09-16T18:00" });
    expect(screen.getByText("common.pricing.days.other")).toBeInTheDocument();
    expect(screen.getByText("appPages.bookingsNew.summaryCountedIn24h")).toBeInTheDocument();
    expect(askingValue()).toHaveTextContent("€30");
  });

  it("charges the whole period price for a stay shorter than the period", () => {
    renderSummary({ service: "boarding", startAt: "2026-09-14T09:00", endAt: "2026-09-15T09:00" });
    expect(askingValue()).toHaveTextContent("€75");
  });

  it("shows the owner's offer beside the asking price", () => {
    renderSummary({ service: "boarding", startAt: "2026-09-14T09:00", endAt: "2026-09-15T09:00", offer: 60 });
    expect(screen.getByText("messages.offer.yours")).toBeInTheDocument();
    expect(screen.getByText("€60")).toBeInTheDocument();
  });

  it("shows the sitter's price list but no asking price while only one date is filled", () => {
    renderSummary({ service: "walking", startAt: "2026-09-14T09:00" });
    expect(screen.getByText("appPages.bookingsNew.summaryRateLabel")).toBeInTheDocument();
    expect(askingValue()).not.toHaveTextContent("€");
  });

  it("flags a reversed range and shows no price", () => {
    renderSummary({ service: "walking", startAt: "2026-09-14T12:00", endAt: "2026-09-14T09:00" });
    expect(screen.getByText("appPages.bookingsNew.summaryInvalidRange")).toBeInTheDocument();
    expect(askingValue()).not.toHaveTextContent("€");
    expect(screen.queryByText(NOT_CHOSEN)).not.toBeInTheDocument();
  });

  it("shows a dash, not 'not chosen' and never €0, when the service has no price", () => {
    renderSummary({
      sitter: { ...sitter, prices: {} } as Profile,
      service: "walking",
      startAt: "2026-09-14T09:00",
      endAt: "2026-09-14T12:00",
    });
    expect(screen.queryByText(NOT_CHOSEN)).not.toBeInTheDocument();
    expect(screen.queryByText(/€0/)).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("prints the date once for a booking that starts and ends on the same day", () => {
    const { container } = renderSummary({ startAt: "2026-09-14T09:00", endAt: "2026-09-14T12:00" });
    expect(container.textContent?.match(/2026/g)?.length).toBe(1);
  });

  it("prints both dates for a booking spanning days", () => {
    const { container } = renderSummary({ startAt: "2026-09-14T09:00", endAt: "2026-09-16T09:00" });
    expect(container.textContent?.match(/2026/g)?.length).toBe(2);
  });

  it("renders without a sitter at all", () => {
    render(<BookingSummary sitter={null} service="" startAt="" endAt="" />);
    expect(screen.getByText("appPages.bookingsNew.summaryTitle")).toBeInTheDocument();
  });
});
