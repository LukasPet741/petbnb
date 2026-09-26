import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCollarTrail } from "@/components/collar/useCollarTrail";
import type { CollarPosition } from "@/lib/collar/types";

const h = vi.hoisted(() => ({ loadPositions: vi.fn() }));
vi.mock("@/lib/collar/api", () => ({ loadPositions: (...a: unknown[]) => h.loadPositions(...a) }));

const p = (s: number, source: "collar" | "replay" = "collar"): CollarPosition => ({
  device_id: "c1", lat: 54.68 + s / 1000, lng: 25.23, speed_kmh: 4, recorded_at: new Date(Date.UTC(2026, 8, 26, 10, 0, s)).toISOString(), source,
});

beforeEach(() => {
  h.loadPositions.mockReset().mockResolvedValue([p(0), p(15)]);
});

describe("useCollarTrail", () => {
  it("loads today's real positions for the collar", async () => {
    const { result } = renderHook(() => useCollarTrail("c1", null, null));
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(h.loadPositions.mock.calls[0][3]).toBe("collar");
  });

  it("appends each new live position", async () => {
    const { result, rerender } = renderHook(({ latest }) => useCollarTrail("c1", latest, null), { initialProps: { latest: null as CollarPosition | null } });
    await waitFor(() => expect(result.current).toHaveLength(2));
    rerender({ latest: p(30) });
    expect(result.current).toHaveLength(3);
  });

  it("starts a fresh trail when a replay begins", async () => {
    const { result, rerender } = renderHook(({ latest }) => useCollarTrail("c1", latest, null), { initialProps: { latest: null as CollarPosition | null } });
    await waitFor(() => expect(result.current).toHaveLength(2));
    rerender({ latest: p(40, "replay") });
    expect(result.current.map((x) => x.source)).toEqual(["replay"]);
    rerender({ latest: p(42, "replay") });
    expect(result.current).toHaveLength(2);
  });

  it("brings back today's real route when a replay ends, even with no real position since", async () => {
    // Review I2: indoors, a replay that stopped left its route on the map under "looking for satellites".
    const { result, rerender } = renderHook(({ latest, replaying }) => useCollarTrail("c1", latest, null, replaying), {
      initialProps: { latest: null as CollarPosition | null, replaying: false },
    });
    await waitFor(() => expect(result.current).toHaveLength(2));
    rerender({ latest: p(40, "replay"), replaying: true });
    expect(result.current.map((x) => x.source)).toEqual(["replay"]);
    rerender({ latest: null, replaying: false });
    await waitFor(() => expect(result.current.map((x) => x.source)).toEqual(["collar", "collar"]));
    expect(h.loadPositions).toHaveBeenCalledTimes(2);
  });

  it("shows a picked day's route and ignores live positions meanwhile", async () => {
    const { result, rerender } = renderHook(({ latest, day }) => useCollarTrail("c1", latest, day), {
      initialProps: { latest: null as CollarPosition | null, day: "2026-09-24" as string | null },
    });
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(h.loadPositions.mock.calls[0][1]).toBe("2026-09-23T21:00:00.000Z");
    rerender({ latest: p(50), day: "2026-09-24" });
    expect(result.current).toHaveLength(2);
  });
});
