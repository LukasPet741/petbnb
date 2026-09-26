import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CollarLiveProvider, useCollarLive, POLL_MS, REPLAY_TICK_MS } from "@/context/CollarLiveContext";
import type { CollarHandlers } from "@/lib/collar/api";
import type { CollarDevice } from "@/lib/collar/types";

const h = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  loadCollars: vi.fn(),
  loadLatest: vi.fn(),
  replay: vi.fn(),
  claim: vi.fn(),
  demo: vi.fn(),
  handlers: null as CollarHandlers | null,
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: h.user, loading: false }) }));
vi.mock("@/lib/collar/api", () => ({
  loadCollars: (...a: unknown[]) => h.loadCollars(...a),
  loadLatest: (...a: unknown[]) => h.loadLatest(...a),
  replayCollarPoint: (...a: unknown[]) => h.replay(...a),
  claimCollar: (...a: unknown[]) => h.claim(...a),
  createDemoCollar: (...a: unknown[]) => h.demo(...a),
  renameCollar: vi.fn(async () => {}),
  unpairCollar: vi.fn(async () => {}),
  subscribeCollars: (_userId: string, handlers: CollarHandlers) => {
    h.handlers = handlers;
    return () => {};
  },
}));

const collar = (over: Partial<CollarDevice> = {}): CollarDevice => ({
  id: "c1", label: "Reksas", is_demo: false, claimed_at: "2026-09-26T08:00:00Z", created_at: "2026-09-26T08:00:00Z",
  last_seen_at: null, gps_locked: null, gps_satellites: null, ...over,
});

function Probe() {
  const live = useCollarLive();
  return (
    <div>
      <p data-testid="state">{live.state}</p>
      <p data-testid="selected">{live.selected?.id ?? "none"}</p>
      <p data-testid="replay">{live.replay ? `${live.replay.idx}/${live.replay.total}` : "off"}</p>
      <p data-testid="replayError">{live.replayError ?? "none"}</p>
      <button onClick={() => void live.startReplay()}>play</button>
      <button onClick={() => live.stopReplay()}>stop</button>
      <button onClick={() => void live.pair("7K3Q9D2M")}>pair</button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  h.user = { id: "u1" };
  h.handlers = null;
  h.loadCollars.mockReset().mockResolvedValue([collar()]);
  h.loadLatest.mockReset().mockResolvedValue({});
  h.replay.mockReset();
  h.claim.mockReset();
  h.demo.mockReset();
});

afterEach(() => vi.useRealTimers());

describe("CollarLiveProvider", () => {
  it("loads the collars, selects the first and works out its state", async () => {
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    expect(text("selected")).toBe("c1");
    expect(text("state")).toBe("waiting");
  });

  it("goes live when a fresh position arrives over Realtime", async () => {
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    act(() => {
      h.handlers!.onPosition({ device_id: "c1", lat: 54.68, lng: 25.23, speed_kmh: 4.2, recorded_at: "2026-09-26T11:59:58Z", source: "collar" });
    });
    expect(text("state")).toBe("live");
  });

  it("falls back to polling every 15 s while Realtime is not connected", async () => {
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    expect(h.loadCollars).toHaveBeenCalledTimes(1);
    await wait(POLL_MS);
    expect(h.loadCollars).toHaveBeenCalledTimes(2);
  });

  it("stops polling once Realtime connects", async () => {
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    act(() => h.handlers!.onStatus(true));
    await wait(POLL_MS * 2);
    expect(h.loadCollars).toHaveBeenCalledTimes(1);
  });

  it("replays one point every 2 s, in order, and stops at the end of the walk", async () => {
    h.replay.mockImplementation(async (_id: string, idx: number) => ({ lat: 54.68, lng: 25.23, speed_kmh: 4, idx, total: 3 }));
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    await flush();
    expect(text("replay")).toBe("1/3");
    expect(text("state")).toBe("replaying");
    await wait(REPLAY_TICK_MS);
    expect(text("replay")).toBe("2/3");
    await wait(REPLAY_TICK_MS);
    expect(text("replay")).toBe("off");
    await wait(REPLAY_TICK_MS * 2);
    expect(h.replay.mock.calls.map((c) => c[1])).toEqual([0, 1, 2]);
  });

  it("keeps replaying with no page mounted, since the loop lives in the provider", async () => {
    h.replay.mockImplementation(async (_id: string, idx: number) => ({ lat: 54.68, lng: 25.23, speed_kmh: 4, idx, total: 10 }));
    function Starter() {
      const live = useCollarLive();
      return <button onClick={() => void live.startReplay()}>play</button>;
    }
    const { rerender } = render(<CollarLiveProvider><Starter /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    await flush();
    rerender(<CollarLiveProvider><p>another page</p></CollarLiveProvider>);
    await wait(REPLAY_TICK_MS * 2);
    expect(h.replay).toHaveBeenCalledTimes(3);
  });

  it("gives up after three failures in a row", async () => {
    h.replay.mockRejectedValue(new Error("Failed to fetch"));
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    await flush();
    await wait(REPLAY_TICK_MS * 2);
    expect(text("replay")).toBe("off");
    expect(text("replayError")).toBe("stopped");
  });

  it("stops at once when there is no recording", async () => {
    h.replay.mockRejectedValue(new Error("no_recording"));
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    await flush();
    expect(text("replayError")).toBe("no_recording");
    expect(text("replay")).toBe("off");
  });

  it("creates the demo collar first when the user has no collar", async () => {
    h.loadCollars.mockResolvedValueOnce([]).mockResolvedValue([collar({ id: "demo-1", is_demo: true })]);
    h.demo.mockResolvedValue("demo-1");
    h.replay.mockResolvedValue({ lat: 54.68, lng: 25.23, speed_kmh: 4, idx: 0, total: 5 });
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    expect(text("state")).toBe("no_collar");
    fireEvent.click(screen.getByText("play"));
    await flush();
    expect(h.replay).toHaveBeenCalledWith("demo-1", 0);
    expect(text("selected")).toBe("demo-1");
  });

  it("creates one demo collar on a double-click, and shows no error while the walk plays", async () => {
    // Review M1 (2026-09-26): the second call hit the one-demo-per-owner index and "The recorded
    // walk stopped." appeared while the walk played.
    h.loadCollars.mockResolvedValueOnce([]).mockResolvedValue([collar({ id: "demo-1", is_demo: true })]);
    h.demo.mockResolvedValueOnce("demo-1").mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    h.replay.mockResolvedValue({ lat: 54.68, lng: 25.23, speed_kmh: 4, idx: 0, total: 5 });
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    fireEvent.click(screen.getByText("play"));
    await flush();
    expect(h.demo).toHaveBeenCalledTimes(1);
    expect(text("replayError")).toBe("none");
    expect(text("selected")).toBe("demo-1");
  });

  it("selects the collar it just paired", async () => {
    h.claim.mockResolvedValue({ deviceId: "c2", result: "paired" });
    h.loadCollars.mockResolvedValueOnce([collar()]).mockResolvedValue([collar(), collar({ id: "c2" })]);
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("pair"));
    await flush();
    expect(text("selected")).toBe("c2");
  });
});
