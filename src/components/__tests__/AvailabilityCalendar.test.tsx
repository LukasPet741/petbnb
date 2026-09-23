import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import { busyMap } from "@/lib/availability";

// No LanguageProvider: t is the identity function, so state names are their keys; the locale
// falls back to English for month and weekday names.

const today = "2026-10-10";
const busy = busyMap([
  { day: "2026-10-12", kind: "off" },
  { day: "2026-10-14", kind: "booked" },
]);
const day = (iso: string) => screen.getByRole("button", { name: new RegExp(`^${iso} `) });

describe("AvailabilityCalendar", () => {
  it("shows two months, starting with today's, Monday first", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="view" />);
    const grids = screen.getAllByRole("grid");
    expect(grids).toHaveLength(2);
    expect(grids[0]).toHaveAccessibleName(/October 2026/);
    expect(grids[1]).toHaveAccessibleName(/November 2026/);
    expect(within(grids[0]).getAllByRole("columnheader")[0]).toHaveTextContent(/^Mon/);
  });

  it("rolls from December into January", () => {
    render(<AvailabilityCalendar busy={new Map()} today="2026-12-20" mode="view" />);
    expect(screen.getAllByRole("grid")[1]).toHaveAccessibleName(/January 2027/);
  });

  it("edit mode: tapping a free day asks to make it a day off, tapping a day off frees it", () => {
    const onToggle = vi.fn();
    render(<AvailabilityCalendar busy={busy} today={today} mode="edit" onToggle={onToggle} />);
    fireEvent.click(day("2026-10-11"));
    fireEvent.click(day("2026-10-12"));
    expect(onToggle.mock.calls).toEqual([["2026-10-11", true], ["2026-10-12", false]]);
  });

  it("edit mode says which days are toggled on", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="edit" onToggle={() => {}} />);
    expect(day("2026-10-12")).toHaveAttribute("aria-pressed", "true");
    expect(day("2026-10-11")).toHaveAttribute("aria-pressed", "false");
  });

  it("booked days, past days and a day being saved cannot be toggled; today can", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="edit" onToggle={() => {}} savingDay="2026-10-20" />);
    expect(day("2026-10-14")).toBeDisabled();
    expect(day("2026-10-09")).toBeDisabled();
    expect(day("2026-10-20")).toBeDisabled();
    expect(day("2026-10-10")).toBeEnabled();
  });

  it("view mode: nothing is a toggle, and every state is said in words", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="view" />);
    expect(day("2026-10-11")).toBeDisabled();
    expect(day("2026-10-11")).not.toHaveAttribute("aria-pressed");
    expect(day("2026-10-12")).toHaveAccessibleName(/appPages\.availability\.state\.off/);
    expect(day("2026-10-14")).toHaveAccessibleName(/appPages\.availability\.state\.booked/);
    expect(day("2026-10-11")).toHaveAccessibleName(/appPages\.availability\.state\.free/);
  });

  it("every day is type=button, so it cannot submit the profile form around it", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="edit" onToggle={() => {}} />);
    expect(day("2026-10-11")).toHaveAttribute("type", "button");
  });

  it("has a legend for the three states", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="view" />);
    const legend = screen.getByRole("list", { name: "appPages.availability.legend" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(3);
  });
});
