import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import WalkScreen from "@/components/collar/WalkScreen";
import { WALK_POLL_MS, WALK_REPLAY_MS, type WalkDetail } from "@/lib/collar/walks";

const h = vi.hoisted(() => ({ loadWalk: vi.fn(), stopWalk: vi.fn() }));
vi.mock("@/lib/collar/walks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/collar/walks")>()),
  loadWalk: (...a: unknown[]) => h.loadWalk(...a),
  stopWalk: (...a: unknown[]) => h.stopWalk(...a),
}));
vi.mock("@/components/collar/LazyCollarMap", () => ({
  default: (props: { path?: unknown[]; showMarker?: boolean; stale?: boolean }) => (
    <div data-testid="map" data-path={String(props.path?.length ?? 0)} data-marker={String(props.showMarker)} />
  ),
}));

const NOW = Date.parse("2026-10-22T10:30:00Z");

const detail = (over: Partial<WalkDetail["walk"]> = {}, rest: Partial<WalkDetail> = {}): WalkDetail => ({
  walk: {
    id: "w1", device_id: "c1", booking_id: "b1", walker_id: "s1", walker_name: "Jonas", walked_by_me: true,
    started_at: "2026-10-22T10:00:00Z", ended_at: null, end_reason: null,
    points: [
      { lat: 54.9, lng: 23.9, speed_kmh: 4, recorded_at: "2026-10-22T10:00:10Z" },
      { lat: 54.905, lng: 23.9, speed_kmh: 4, recorded_at: "2026-10-22T10:15:00Z" },
      { lat: 54.91, lng: 23.9, speed_kmh: 4, recorded_at: "2026-10-22T10:29:50Z" },
    ],
    ...over,
  },
  collar: { label: "Antkaklis", last_seen_at: "2026-10-22T10:29:50Z", gps_locked: true, gps_satellites: 7 },
  pet_name: "Rudis",
  is_owner: false,
  can_stop: true,
  ...rest,
});

const saved = () => detail({ ended_at: "2026-10-22T10:29:50Z", end_reason: "stopped" }, { can_stop: false, collar: null });

async function flush() {
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(NOW);
  h.loadWalk.mockReset();
  h.stopWalk.mockReset();
});

afterEach(() => vi.useRealTimers());

describe("WalkScreen", () => {
  it("shows a running walk live with its time, distance and Stop", async () => {
    h.loadWalk.mockResolvedValue(detail());
    render(<WalkScreen walkId="w1" />);
    await flush();
    expect(screen.getByText("appPages.collar.walks.live")).toBeTruthy();
    expect(screen.getByText("30 min")).toBeTruthy();
    expect(screen.getByText("1.11 km")).toBeTruthy();
    expect(screen.getByRole("button", { name: "appPages.collar.walks.stop" })).toBeTruthy();
    expect(screen.getByTestId("map").dataset.path).toBe("3");
  });

  it("asks again every few seconds while the walk runs", async () => {
    h.loadWalk.mockResolvedValue(detail());
    render(<WalkScreen walkId="w1" />);
    await flush();
    expect(h.loadWalk).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(WALK_POLL_MS);
    });
    expect(h.loadWalk).toHaveBeenCalledTimes(2);
    expect(h.loadWalk).toHaveBeenLastCalledWith("w1");
  });

  it("says so when Stop finds no positions to save", async () => {
    h.loadWalk.mockResolvedValue(detail({ points: [] }));
    h.stopWalk.mockResolvedValue("dropped");
    render(<WalkScreen walkId="w1" />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.stop" }));
    await flush();
    expect(h.stopWalk).toHaveBeenCalledWith("w1");
    expect(screen.getByText("appPages.collar.walks.dropped")).toBeTruthy();
    expect(screen.queryByTestId("map")).toBeNull();
  });

  it("shows a saved walk with Replay and stops asking", async () => {
    h.loadWalk.mockResolvedValue(saved());
    render(<WalkScreen walkId="w1" />);
    await flush();
    expect(screen.getByText("appPages.collar.walks.savedTitle")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "appPages.collar.walks.stop" })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(WALK_POLL_MS * 2);
    });
    expect(h.loadWalk).toHaveBeenCalledTimes(1);
  });

  it("replays a saved walk point by point, then shows the whole route again", async () => {
    h.loadWalk.mockResolvedValue(saved());
    render(<WalkScreen walkId="w1" />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.replay" }));
    expect(screen.getByTestId("map").dataset.path).toBe("1");
    await act(async () => {
      vi.advanceTimersByTime(WALK_REPLAY_MS);
    });
    expect(screen.getByTestId("map").dataset.path).toBe("2");
    // One step per tick: each point schedules the next once it has rendered.
    for (let step = 0; step < 2; step++) {
      await act(async () => {
        vi.advanceTimersByTime(WALK_REPLAY_MS);
      });
    }
    expect(screen.getByTestId("map").dataset.path).toBe("3");
    expect(screen.getByRole("button", { name: "appPages.collar.walks.replay" })).toBeTruthy();
  });

  it("says a walk that is not yours is not available", async () => {
    h.loadWalk.mockResolvedValue(null);
    render(<WalkScreen walkId="w1" />);
    await flush();
    expect(screen.getByText("appPages.collar.walks.notFound")).toBeTruthy();
  });

  it("leads the sitter back to bookings and the owner back to the collar", async () => {
    h.loadWalk.mockResolvedValue(detail());
    const { unmount } = render(<WalkScreen walkId="w1" />);
    await flush();
    expect(screen.getByRole("link", { name: /appPages.collar.walks.back/ }).getAttribute("href")).toBe("/bookings");
    unmount();
    h.loadWalk.mockResolvedValue(detail({}, { is_owner: true }));
    render(<WalkScreen walkId="w1" />);
    await flush();
    expect(screen.getByRole("link", { name: /appPages.collar.walks.back/ }).getAttribute("href")).toBe("/collar");
  });
});
