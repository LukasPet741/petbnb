import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServicePrice } from "@/components/PriceTag";

/**
 * One service's price as the sitter set it, on their profile. Rendered without a
 * LanguageProvider, so `t` returns the key and interpolation is not applied.
 */

describe("ServicePrice", () => {
  it("shows a one-day price per day", () => {
    const { container } = render(<ServicePrice prices={{ walking: { amount: 12, days: 1 } }} service="walking" />);
    expect(container).toHaveTextContent("€12");
    expect(container).toHaveTextContent("common.pricing.perDay");
    expect(container).not.toHaveTextContent("common.pricing.approxPerDay");
  });

  it("shows a longer period as set, with its daily equivalent", () => {
    const { container } = render(<ServicePrice prices={{ boarding: { amount: 75, days: 3 } }} service="boarding" />);
    expect(container).toHaveTextContent("€75");
    expect(container).toHaveTextContent("common.pricing.perDays");
    expect(container).toHaveTextContent("common.pricing.approxPerDay");
  });

  it("shows grooming per visit", () => {
    const { container } = render(<ServicePrice prices={{ grooming: { amount: 36 } }} service="grooming" />);
    expect(container).toHaveTextContent("€36");
    expect(container).toHaveTextContent("common.pricing.perVisit");
  });

  it("says when a service has no price", () => {
    render(<ServicePrice prices={{}} service="daycare" />);
    expect(screen.getByText("common.pricing.noPrice")).toBeInTheDocument();
  });
});
