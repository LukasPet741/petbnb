import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  claimCollar, createDemoCollar, loadCollars, loadPositions, loadPetNames, renameCollar,
  replayCollarPoint, sortCollars, subscribeCollars, unpairCollar,
} from "@/lib/collar/api";
import type { CollarDevice } from "@/lib/collar/types";

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  error: null as null | { message: string },
  rpcResult: { data: null as unknown, error: null as null | { message: string } },
  calls: [] as unknown[][],
  handlers: [] as Array<{ filter: Record<string, string>; cb: (payload: { new: unknown }) => void }>,
  statusCb: null as null | ((status: string) => void),
  removed: 0,
}));

vi.mock("@/lib/supabase", () => {
  const builder = () => {
    const chain: Record<string, unknown> = {};
    for (const op of ["select", "eq", "is", "gte", "lte", "order", "limit", "update"]) {
      chain[op] = (...args: unknown[]) => {
        h.calls.push([op, ...args]);
        return chain;
      };
    }
    chain.maybeSingle = async () => ({ data: h.rows[0] ?? null, error: h.error });
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: h.rows, error: h.error }));
    return chain;
  };
  const channel = {
    on: (_type: string, filter: Record<string, string>, cb: (payload: { new: unknown }) => void) => {
      h.handlers.push({ filter, cb });
      return channel;
    },
    subscribe: (cb: (status: string) => void) => {
      h.statusCb = cb;
      return channel;
    },
  };
  return {
    supabase: {
      from: (table: string) => {
        h.calls.push(["from", table]);
        return builder();
      },
      rpc: async (...args: unknown[]) => {
        h.calls.push(["rpc", ...args]);
        return h.rpcResult;
      },
      channel: (name: string) => {
        h.calls.push(["channel", name]);
        return channel;
      },
      removeChannel: async () => {
        h.removed += 1;
      },
    },
  };
});

const device = (over: Partial<CollarDevice>): CollarDevice => ({
  id: "c", label: null, is_demo: false, claimed_at: null, created_at: "2026-09-01T00:00:00Z",
  last_seen_at: null, gps_locked: null, gps_satellites: null, ...over,
});

beforeEach(() => {
  h.rows = [];
  h.error = null;
  h.rpcResult = { data: null, error: null };
  h.calls = [];
  h.handlers = [];
  h.statusCb = null;
  h.removed = 0;
});

describe("collars", () => {
  it("sorts real collars before the demo one, most recently seen first", () => {
    const sorted = sortCollars([
      device({ id: "demo", is_demo: true, last_seen_at: "2026-09-26T12:00:00Z" }),
      device({ id: "old", last_seen_at: "2026-09-20T12:00:00Z" }),
      device({ id: "new", last_seen_at: "2026-09-26T11:00:00Z" }),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(["new", "old", "demo"]);
  });

  it("loads collars from collar_devices and throws the database message on error", async () => {
    h.rows = [device({ id: "a" })];
    expect((await loadCollars()).map((d) => d.id)).toEqual(["a"]);
    expect(h.calls[0]).toEqual(["from", "collar_devices"]);
    h.error = { message: "boom" };
    await expect(loadCollars()).rejects.toThrow("boom");
  });

  it("loads a day's positions oldest first, filtered by source", async () => {
    await loadPositions("c1", "2026-09-26T00:00:00Z", "2026-09-26T23:59:59Z", "collar");
    expect(h.calls).toContainEqual(["eq", "source", "collar"]);
    expect(h.calls).toContainEqual(["order", "recorded_at", { ascending: true }]);
  });

  it("loads the owner's pet names", async () => {
    h.rows = [{ name: "Reksas" }, { name: "Mica" }];
    expect(await loadPetNames("u1")).toEqual(["Reksas", "Mica"]);
    expect(h.calls).toContainEqual(["eq", "owner_id", "u1"]);
    expect(h.calls).toContainEqual(["is", "archived_at", null]);
  });
});

describe("pairing and changes", () => {
  it("maps claim_collar's row", async () => {
    h.rpcResult = { data: [{ device_id: "c9", result: "paired" }], error: null };
    expect(await claimCollar("7K3Q9D2M")).toEqual({ deviceId: "c9", result: "paired" });
    expect(h.calls).toContainEqual(["rpc", "claim_collar", { p_code: "7K3Q9D2M", p_label: undefined }]);
  });

  it("throws when claiming fails", async () => {
    h.rpcResult = { data: null, error: { message: "Failed to fetch" } };
    await expect(claimCollar("7K3Q9D2M")).rejects.toThrow("Failed to fetch");
  });

  it("renames with a plain update of the label", async () => {
    await renameCollar("c1", "Bobis");
    expect(h.calls).toContainEqual(["update", { label: "Bobis" }]);
    expect(h.calls).toContainEqual(["eq", "id", "c1"]);
  });

  it("unpairs and creates the demo collar through their functions", async () => {
    await unpairCollar("c1");
    expect(h.calls).toContainEqual(["rpc", "unpair_collar", { p_device_id: "c1" }]);
    h.rpcResult = { data: "demo-1", error: null };
    expect(await createDemoCollar()).toBe("demo-1");
  });

  it("returns a replayed point and passes the database's reason on failure", async () => {
    h.rpcResult = { data: [{ lat: 54.68, lng: 25.23, speed_kmh: 4.2, idx: 3, total: 64 }], error: null };
    expect(await replayCollarPoint("c1", 3)).toEqual({ lat: 54.68, lng: 25.23, speed_kmh: 4.2, idx: 3, total: 64 });
    h.rpcResult = { data: null, error: { message: "no_recording" } };
    await expect(replayCollarPoint("c1", 0)).rejects.toThrow("no_recording");
  });
});

describe("subscribeCollars", () => {
  it("passes new positions and device updates through, without extra columns", () => {
    const onPosition = vi.fn();
    const onDevice = vi.fn();
    const onStatus = vi.fn();
    subscribeCollars("u1", { onPosition, onDevice, onStatus });

    const positions = h.handlers.find((x) => x.filter.table === "collar_locations")!;
    positions.cb({ new: { id: 7, device_id: "c1", lat: 1, lng: 2, speed_kmh: null, battery_pct: null, recorded_at: "t", created_at: "t", source: "collar" } });
    expect(onPosition).toHaveBeenCalledWith({ device_id: "c1", lat: 1, lng: 2, speed_kmh: null, recorded_at: "t", source: "collar" });

    const devices = h.handlers.find((x) => x.filter.table === "collar_devices")!;
    devices.cb({ new: { id: "c1", owner_id: "u1", device_secret_hash: "$2a$…", pair_code: "7K3Q9D2M", label: "R", is_demo: false, claimed_at: null, created_at: "t", last_seen_at: "t2", gps_locked: false, gps_satellites: 3 } });
    expect(onDevice).toHaveBeenCalledWith({ id: "c1", label: "R", is_demo: false, claimed_at: null, created_at: "t", last_seen_at: "t2", gps_locked: false, gps_satellites: 3 });

    h.statusCb?.("SUBSCRIBED");
    expect(onStatus).toHaveBeenLastCalledWith(true);
  });

  it("reports offline and removes the channel when unsubscribed", () => {
    const onStatus = vi.fn();
    const stop = subscribeCollars("u1", { onPosition: vi.fn(), onDevice: vi.fn(), onStatus });
    stop();
    expect(onStatus).toHaveBeenLastCalledWith(false);
    expect(h.removed).toBe(1);
  });
});
