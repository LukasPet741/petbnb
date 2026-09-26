import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WeekCard from "@/components/collar/WeekCard";

const h = vi.hoisted(() => ({ loadPositions: vi.fn() }));
vi.mock("@/lib/collar/api", () => ({ loadPositions: (...a: unknown[]) => h.loadPositions(...a) }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-26T12:00:00+03:00"));
  // The local day 2026-09-24 starts at 2026-09-23T21:00Z (Vilnius is UTC+3 in September).
  h.loadPositions.mockReset().mockImplementation(async (_id: string, from: string) =>
    from.startsWith("2026-09-23T21")
      ? [
          { device_id: "c1", lat: 54.68, lng: 25.28, speed_kmh: 4, recorded_at: "2026-09-25T10:00:00Z", source: "collar" },
          { device_id: "c1", lat: 54.69, lng: 25.28, speed_kmh: 5, recorded_at: "2026-09-25T10:15:00Z", source: "collar" },
        ]
      : [],
  );
});

afterEach(() => vi.useRealTimers());

describe("WeekCard", () => {
  it("adds up the last seven days of real positions and draws a bar per day", async () => {
    render(<WeekCard deviceId="c1" selectedDay={null} onSelectDay={() => {}} />);
    expect(await screen.findByText("1.1")).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: false }).length + screen.getAllByRole("button", { pressed: true }).length).toBe(7);
    for (const call of h.loadPositions.mock.calls) expect(call[3]).toBe("collar");
  });

  it("picks a day, and today again", async () => {
    const onSelectDay = vi.fn();
    render(<WeekCard deviceId="c1" selectedDay={null} onSelectDay={onSelectDay} />);
    await screen.findByText("1.1");
    const bars = screen.getAllByRole("button");
    fireEvent.click(bars[4]);
    expect(onSelectDay).toHaveBeenCalledWith("2026-09-24");
    fireEvent.click(bars[6]);
    expect(onSelectDay).toHaveBeenLastCalledWith(null);
  });

  it("says so when there were no walks", async () => {
    h.loadPositions.mockResolvedValue([]);
    render(<WeekCard deviceId="c1" selectedDay={null} onSelectDay={() => {}} />);
    // Once for the week, once for the activity card.
    expect(await screen.findAllByText("appPages.collar.week.empty")).toHaveLength(2);
  });
});
