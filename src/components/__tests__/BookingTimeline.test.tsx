import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BookingTimeline from "@/components/BookingTimeline";

// No LanguageProvider: t is the identity function, so labels are their keys.

const END = "2026-10-03T09:00:00+03:00";
const LABEL = "appPages.bookings.timeline.label";

describe("BookingTimeline", () => {
  it("lists the four steps in order and marks the one the booking waits on", () => {
    render(<BookingTimeline status="pending" endAt={END} now={Date.parse("2026-09-22T12:00:00+03:00")} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-state"))).toEqual(["done", "current", "todo", "todo"]);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items.filter((li) => li.hasAttribute("aria-current"))).toHaveLength(1);
    expect(screen.getByRole("list", { name: LABEL })).toBeInTheDocument();
  });

  it("names every step", () => {
    render(<BookingTimeline status="completed" endAt={END} now={Date.parse("2026-10-05T12:00:00+03:00")} />);
    for (const key of ["requested", "accepted", "inProgress", "completed"]) {
      expect(screen.getByText(`appPages.bookings.timeline.${key}`)).toBeInTheDocument();
    }
  });

  it("renders nothing for a cancelled booking", () => {
    const { container } = render(<BookingTimeline status="cancelled" endAt={END} />);
    expect(container).toBeEmptyDOMElement();
  });
});
