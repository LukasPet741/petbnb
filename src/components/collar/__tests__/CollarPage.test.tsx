import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import CollarPage from "@/components/collar/CollarPage";
import { EMPTY_COLLAR_LIVE, type CollarLiveValue } from "@/context/CollarLiveContext";
import type { CollarDevice } from "@/lib/collar/types";

const h = vi.hoisted(() => ({ live: null as unknown as CollarLiveValue }));

vi.mock("@/context/CollarLiveContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/CollarLiveContext")>();
  return { ...actual, useCollarLive: () => h.live };
});
vi.mock("@/components/collar/CollarHero", () => ({
  default: (p: { state: string; latest: { source: string } | null }) => (
    <div data-testid="hero" data-latest={p.latest ? p.latest.source : "none"}>{p.state}</div>
  ),
}));
vi.mock("@/components/collar/WeekCard", () => ({ default: () => <div data-testid="week" /> }));
vi.mock("@/components/collar/useCollarTrail", () => ({ useCollarTrail: () => [] }));
vi.mock("@/components/collar/PairingWizard", () => ({
  default: ({ onClose }: { onClose: () => void }) => <div data-testid="wizard"><button onClick={onClose}>close-wizard</button></div>,
}));

const reksas: CollarDevice = {
  id: "c1", label: "Reksas", is_demo: false, claimed_at: "2026-09-24T10:00:00Z", created_at: "2026-09-24T10:00:00Z",
  last_seen_at: "2026-09-26T11:59:58Z", gps_locked: true, gps_satellites: 7,
};

function live(over: Partial<CollarLiveValue> = {}): CollarLiveValue {
  return {
    ...EMPTY_COLLAR_LIVE,
    collars: [reksas],
    selected: reksas,
    state: "live",
    select: vi.fn(),
    startReplay: vi.fn(async () => {}),
    stopReplay: vi.fn(),
    rename: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    ...over,
  };
}

beforeEach(() => {
  h.live = live();
});

describe("CollarPage", () => {
  it("shows a spinner while the collars load", () => {
    h.live = live({ loading: true });
    render(<CollarPage />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("offers pairing and the recorded walk when there is no collar", () => {
    h.live = live({ collars: [], selected: null, state: "no_collar" });
    render(<CollarPage />);
    expect(screen.getByRole("heading", { level: 1, name: "appPages.collar.empty.title" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.empty.pair" }));
    expect(screen.getByTestId("wizard")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.play/ }));
    expect(h.live.startReplay).toHaveBeenCalled();
  });

  it("names the collar, shows its state and the week", () => {
    render(<CollarPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Reksas" })).toBeTruthy();
    expect(screen.getByText("appPages.collar.states.live")).toBeTruthy();
    expect(screen.getByTestId("hero").textContent).toBe("live");
    expect(screen.getByTestId("week")).toBeTruthy();
  });

  it("plays the recorded walk, and stops it", () => {
    render(<CollarPage />);
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.play/ }));
    expect(h.live.startReplay).toHaveBeenCalled();
    h.live = live({ state: "replaying", replay: { deviceId: "c1", idx: 3, total: 64 } });
    render(<CollarPage />);
    fireEvent.click(screen.getAllByRole("button", { name: /appPages\.collar\.stop/ })[0]);
    expect(h.live.stopReplay).toHaveBeenCalled();
  });

  it("shows the collar's own position after a replay, not the recording's end point (review I2)", () => {
    const replayEnd = { device_id: "c1", lat: 54.68, lng: 25.23, speed_kmh: 4, recorded_at: "2026-09-26T11:59:00Z", source: "replay" as const };
    h.live = live({ state: "searching", latest: replayEnd, latestReal: null });
    render(<CollarPage />);
    expect(screen.getByTestId("hero").dataset.latest).toBe("none");
  });

  it("shows the recording's point while it plays", () => {
    const point = { device_id: "c1", lat: 54.68, lng: 25.23, speed_kmh: 4, recorded_at: "2026-09-26T11:59:58Z", source: "replay" as const };
    h.live = live({ state: "replaying", latest: point, latestReal: null, replay: { deviceId: "c1", idx: 3, total: 64 } });
    render(<CollarPage />);
    expect(screen.getByTestId("hero").dataset.latest).toBe("replay");
  });

  it("names a demo collar in the page language and hides the week", () => {
    const demo = { ...reksas, id: "d1", is_demo: true, label: "Recorded walk" };
    h.live = live({ collars: [demo], selected: demo, state: "demo_idle" });
    render(<CollarPage />);
    expect(screen.getByRole("heading", { level: 1, name: "appPages.collar.demoName" })).toBeTruthy();
    expect(screen.queryByTestId("week")).toBeNull();
  });

  it("switches between collars with chips", () => {
    const second = { ...reksas, id: "c2", label: "Mica" };
    h.live = live({ collars: [reksas, second] });
    render(<CollarPage />);
    fireEvent.click(screen.getByRole("button", { name: "Mica" }));
    expect(h.live.select).toHaveBeenCalledWith("c2");
  });

  it("renames the collar from the menu", () => {
    render(<CollarPage />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "appPages.collar.rename" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("appPages.collar.nameLabel"), { target: { value: "Bobis" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "appPages.collar.save" }));
    expect(h.live.rename).toHaveBeenCalledWith("c1", "Bobis");
  });

  it("removes the collar after confirming", () => {
    render(<CollarPage />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "appPages.collar.remove" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "appPages.collar.remove" }));
    expect(h.live.remove).toHaveBeenCalledWith("c1");
  });
});
