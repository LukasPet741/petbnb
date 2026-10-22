import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import WalksCard from "@/components/collar/WalksCard";
import type { CollarWalk } from "@/lib/collar/walks";

const h = vi.hoisted(() => ({ loadDeviceWalks: vi.fn(), startWalk: vi.fn(), stopWalk: vi.fn() }));
vi.mock("@/lib/collar/walks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/collar/walks")>()),
  loadDeviceWalks: (...a: unknown[]) => h.loadDeviceWalks(...a),
  startWalk: (...a: unknown[]) => h.startWalk(...a),
  stopWalk: (...a: unknown[]) => h.stopWalk(...a),
}));

const NOW = Date.parse("2026-10-22T10:30:00Z");

const walk = (id: string, over: Partial<CollarWalk> = {}): CollarWalk => ({
  id, device_id: "c1", booking_id: null, walker_id: "u1", walker_name: "Lukas", walked_by_me: true,
  started_at: "2026-10-22T10:00:00Z", ended_at: "2026-10-22T10:30:00Z", end_reason: "stopped",
  points: [
    { lat: 54.9, lng: 23.9, speed_kmh: 4, recorded_at: "2026-10-22T10:00:10Z" },
    { lat: 54.91, lng: 23.9, speed_kmh: 4, recorded_at: "2026-10-22T10:29:50Z" },
  ],
  ...over,
});

async function renderCard() {
  render(<WalksCard deviceId="c1" now={NOW} />);
  await act(async () => {});
}

beforeEach(() => {
  h.loadDeviceWalks.mockReset().mockResolvedValue({ running: null, recent: [] });
  h.startWalk.mockReset().mockResolvedValue("w9");
  h.stopWalk.mockReset().mockResolvedValue("saved");
});

describe("WalksCard", () => {
  it("starts the owner's own walk on this collar", async () => {
    await renderCard();
    expect(screen.getByText("appPages.collar.walks.none")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.start" }));
    await act(async () => {});
    expect(h.startWalk).toHaveBeenCalledWith("c1");
    expect(h.loadDeviceWalks).toHaveBeenCalledTimes(2);
  });

  it("shows the running walk with who walks it, and stops it", async () => {
    h.loadDeviceWalks.mockResolvedValue({ running: walk("w1", { ended_at: null, end_reason: null, walked_by_me: false, walker_name: "Jonas" }), recent: [] });
    await renderCard();
    expect(screen.getByText(/appPages.collar.walks.inProgress/)).toBeTruthy();
    expect(screen.getByText(/Jonas/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "appPages.collar.walks.start" })).toBeNull();
    expect(screen.getByRole("link", { name: "appPages.collar.walks.open" }).getAttribute("href")).toBe("/walks/w1");
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.stop" }));
    await act(async () => {});
    expect(h.stopWalk).toHaveBeenCalledWith("w1");
  });

  it("names the owner's own running walk as theirs", async () => {
    h.loadDeviceWalks.mockResolvedValue({ running: walk("w1", { ended_at: null, end_reason: null }), recent: [] });
    await renderCard();
    expect(screen.getByText(/appPages.collar.walks.you/)).toBeTruthy();
  });

  it("lists the recent walks, each opening its walk screen", async () => {
    h.loadDeviceWalks.mockResolvedValue({ running: null, recent: [walk("w3"), walk("w2"), walk("w1")] });
    await renderCard();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/walks/w3", "/walks/w2", "/walks/w1"]);
  });

  it("says a walk is already running when the collar is taken", async () => {
    h.startWalk.mockRejectedValue(new Error("walk_running"));
    await renderCard();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.start" }));
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toBe("appPages.collar.walks.running");
  });

  it("says when a stopped walk had nothing to save", async () => {
    h.loadDeviceWalks.mockResolvedValue({ running: walk("w1", { ended_at: null, end_reason: null }), recent: [] });
    h.stopWalk.mockResolvedValue("dropped");
    await renderCard();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.stop" }));
    await act(async () => {});
    expect(screen.getByText("appPages.collar.walks.dropped")).toBeTruthy();
  });
});
