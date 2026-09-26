import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CollarHero from "@/components/collar/CollarHero";
import type { CollarDevice, CollarPosition, CollarState } from "@/lib/collar/types";

vi.mock("@/components/collar/LazyCollarMap", () => ({
  default: (props: { showMarker?: boolean; stale?: boolean }) => (
    <div data-testid="map" data-marker={String(props.showMarker)} data-stale={String(props.stale)} />
  ),
}));
vi.mock("@/lib/collar/placeName", () => ({ lookupPlace: async () => "Vingio parkas" }));

const NOW = Date.parse("2026-09-26T12:00:00Z");
const device: CollarDevice = {
  id: "c1", label: "Reksas", is_demo: false, claimed_at: "2026-09-24T10:00:00Z", created_at: "2026-09-24T10:00:00Z",
  last_seen_at: "2026-09-26T11:48:00Z", gps_locked: false, gps_satellites: 2,
};
const latest: CollarPosition = {
  device_id: "c1", lat: 54.683, lng: 25.233, speed_kmh: 4.2, recorded_at: "2026-09-26T11:59:57Z", source: "collar",
};

function hero(state: CollarState, over: Partial<Parameters<typeof CollarHero>[0]> = {}) {
  const onPlay = vi.fn();
  const onStop = vi.fn();
  render(
    <CollarHero state={state} device={device} latest={latest} trail={[latest]} fitKey="c1:today" now={NOW}
      replay={null} replayError={null} onPlay={onPlay} onStop={onStop} {...over} />,
  );
  return { onPlay, onStop };
}

describe("CollarHero", () => {
  it("shows speed, activity and satellites while live", async () => {
    hero("live", { device: { ...device, gps_satellites: 7, last_seen_at: "2026-09-26T11:59:57Z" } });
    expect(screen.getAllByText("4.2").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/appPages\.collar\.activity\.walking/).length).toBeGreaterThan(0);
    expect(screen.getByText("appPages.collar.satellitesLocked")).toBeTruthy();
    expect(screen.getByText("appPages.collar.onWifi")).toBeTruthy();
    // On the desktop card and the phone chip (both in the DOM; CSS picks one).
    expect((await screen.findAllByText(/Vingio parkas/)).length).toBeGreaterThan(0);
  });

  it("shows the replay banner with progress and a Stop button while replaying", () => {
    const { onStop } = hero("replaying", { latest: { ...latest, source: "replay" }, replay: { deviceId: "c1", idx: 23, total: 64 } });
    expect(screen.getByText("appPages.collar.replay.title")).toBeTruthy();
    expect(screen.getByText(/appPages\.collar\.replay\.progress/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("23");
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.stop/ }));
    expect(onStop).toHaveBeenCalled();
  });

  it("explains searching indoors and offers the recorded walk", () => {
    const { onPlay } = hero("searching", { latest: null });
    expect(screen.getByText("appPages.collar.searching.title")).toBeTruthy();
    expect(screen.getByText("appPages.collar.searching.count")).toBeTruthy();
    expect(screen.getByTestId("map").dataset.marker).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.play/ }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("shows offline with a grey marker at the last position", () => {
    hero("offline");
    expect(screen.getByText("appPages.collar.offline.title")).toBeTruthy();
    expect(screen.getByText("appPages.collar.offline.lastSeen")).toBeTruthy();
    expect(screen.getByTestId("map").dataset.stale).toBe("true");
  });

  it("shows waiting for a collar that never checked in", () => {
    hero("waiting", { latest: null });
    expect(screen.getByText("appPages.collar.waiting.title")).toBeTruthy();
  });

  it("offers to play again on an idle demo collar", () => {
    const { onPlay } = hero("demo_idle", { device: { ...device, is_demo: true } });
    expect(screen.getByText("appPages.collar.demoIdle.title")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.play/ }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("says the recorded walk stopped and offers to try again", () => {
    const { onPlay } = hero("searching", { replayError: "stopped" });
    expect(screen.getByText("appPages.collar.replay.stopped")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.replay\.tryAgain/ }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("says the signal is too weak, not '7 of 4 needed', when enough satellites are in view", () => {
    // Review M4 (2026-09-26): indoors a NEO-6M often lists 5–12 satellites in view without a lock.
    hero("searching", { latest: null, device: { ...device, gps_satellites: 7 } });
    expect(screen.getByText("appPages.collar.searching.countWeak")).toBeTruthy();
    expect(screen.queryByText("appPages.collar.searching.count")).toBeNull();
  });

  it("draws no marker while searching, even when a last position is known", () => {
    // The approved mockup: "looking for satellites" has no dot; one would claim a position (review I2).
    hero("searching");
    expect(screen.getByTestId("map").dataset.marker).toBe("false");
  });

  it("keeps the map's layers inside its own box, under the page's dialogs", () => {
    hero("live");
    // Leaflet's panes (z 200–1000) and the z-800 cards otherwise paint over the pairing wizard
    // and the rename/remove dialogs (z-50) that open on this page — seen in the /dev sandbox.
    expect(screen.getByTestId("map").closest(".isolate")).not.toBeNull();
  });

  it("says when there is no recording yet", () => {
    hero("searching", { replayError: "no_recording" });
    expect(screen.getByText("appPages.collar.replay.noRecording")).toBeTruthy();
  });
});
