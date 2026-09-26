"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  claimCollar, createDemoCollar, loadCollars, loadLatest, renameCollar, replayCollarPoint,
  subscribeCollars, unpairCollar, type ClaimResult,
} from "@/lib/collar/api";
import { EMPTY_PAIR, mergePosition, type LatestPair } from "@/lib/collar/positions";
import { collarState } from "@/lib/collar/status";
import type { CollarDevice, CollarPosition, CollarState } from "@/lib/collar/types";

/**
 * The user's collars, live, for the whole signed-in app (mounted once in (app)/layout.tsx). The
 * sidebar card, the phone's collar button and /collar all read this, so there is one Realtime
 * channel and one recorded-walk loop — and the walk keeps playing while the user clicks around.
 */

export const REPLAY_TICK_MS = 2000;
export const POLL_MS = 15_000;
export const CLOCK_MS = 5000;
export const REPLAY_MAX_FAILURES = 3;

export interface ReplayProgress {
  deviceId: string;
  idx: number;
  total: number;
}

export type ReplayError = "stopped" | "no_recording";

export interface CollarLiveValue {
  loading: boolean;
  collars: CollarDevice[];
  selected: CollarDevice | null;
  select: (id: string) => void;
  latest: CollarPosition | null;
  latestReal: CollarPosition | null;
  state: CollarState;
  now: number;
  realtime: boolean;
  replay: ReplayProgress | null;
  replayError: ReplayError | null;
  startReplay: () => Promise<void>;
  stopReplay: () => void;
  refresh: () => Promise<void>;
  pair: (code: string) => Promise<ClaimResult>;
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const EMPTY_COLLAR_LIVE: CollarLiveValue = {
  loading: false,
  collars: [],
  selected: null,
  select: () => {},
  latest: null,
  latestReal: null,
  state: "no_collar",
  now: 0,
  realtime: false,
  replay: null,
  replayError: null,
  startReplay: async () => {},
  stopReplay: () => {},
  refresh: async () => {},
  pair: async () => ({ deviceId: null, result: "not_found" }),
  rename: async () => {},
  remove: async () => {},
};

export const CollarLiveContext = createContext<CollarLiveValue | null>(null);

/** Outside the provider (public pages, sandboxes) this reads as "no collar", never a crash. */
export function useCollarLive(): CollarLiveValue {
  return useContext(CollarLiveContext) ?? EMPTY_COLLAR_LIVE;
}

interface ReplayRun {
  deviceId: string;
  idx: number;
  failures: number;
  busy: boolean;
}

export function CollarLiveProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [collars, setCollars] = useState<CollarDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [latestById, setLatestById] = useState<Record<string, LatestPair>>({});
  const [now, setNow] = useState(() => Date.now());
  const [realtime, setRealtime] = useState(false);
  const [replay, setReplay] = useState<ReplayProgress | null>(null);
  const [replayError, setReplayError] = useState<ReplayError | null>(null);
  const runRef = useRef<ReplayRun | null>(null);
  // A double-click on Play must not create two demo collars: the second hits the one-per-owner
  // index and "the recorded walk stopped" showed while it played (review M1, 2026-09-26).
  const startingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCollars([]);
      setLatestById({});
      setSelectedId(null);
      setLoading(false);
      return;
    }
    try {
      const devices = await loadCollars();
      const latest = await loadLatest(devices.map((d) => d.id));
      setCollars(devices);
      setLatestById(latest);
      setSelectedId((current) => (current && devices.some((d) => d.id === current) ? current : devices[0]?.id ?? null));
      setNow(Date.now());
    } catch {
      // Keep what is on screen; the next poll or Realtime event tries again.
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    return subscribeCollars(userId, {
      onPosition: (position) => {
        setLatestById((prev) => mergePosition(prev, position));
        setNow(Date.now());
      },
      onDevice: (device) => setCollars((prev) => prev.map((c) => (c.id === device.id ? { ...c, ...device } : c))),
      onStatus: setRealtime,
    });
  }, [userId]);

  // Realtime can be blocked (captive Wi-Fi, proxies); the page must still move.
  useEffect(() => {
    if (!userId || realtime) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [userId, realtime, refresh]);

  // Ages ("updated 20 s ago", live → searching after 45 s) change without any new data.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);

  const stopReplay = useCallback(() => {
    runRef.current = null;
    setReplay(null);
  }, []);

  const tickReplay = useCallback(async () => {
    const run = runRef.current;
    if (!run || run.busy) return;
    run.busy = true;
    try {
      const point = await replayCollarPoint(run.deviceId, run.idx);
      if (runRef.current !== run) return;
      run.failures = 0;
      const position: CollarPosition = {
        device_id: run.deviceId,
        lat: point.lat,
        lng: point.lng,
        speed_kmh: point.speed_kmh,
        recorded_at: new Date().toISOString(),
        source: "replay",
      };
      setLatestById((prev) => mergePosition(prev, position));
      setNow(Date.now());
      run.idx = point.idx + 1;
      if (run.idx >= point.total) {
        stopReplay();
        return;
      }
      setReplay({ deviceId: run.deviceId, idx: run.idx, total: point.total });
    } catch (error) {
      if (runRef.current !== run) return;
      if (error instanceof Error && error.message.includes("no_recording")) {
        setReplayError("no_recording");
        stopReplay();
        return;
      }
      run.failures += 1;
      if (run.failures >= REPLAY_MAX_FAILURES) {
        setReplayError("stopped");
        stopReplay();
      }
    } finally {
      run.busy = false;
    }
  }, [stopReplay]);

  const replayingId = replay?.deviceId ?? null;
  useEffect(() => {
    if (!replayingId) return;
    const timer = setInterval(() => void tickReplay(), REPLAY_TICK_MS);
    return () => clearInterval(timer);
  }, [replayingId, tickReplay]);

  const startReplay = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      setReplayError(null);
      let deviceId = selectedId;
      if (!deviceId) {
        try {
          deviceId = await createDemoCollar();
        } catch {
          setReplayError("stopped");
          return;
        }
        await refresh();
        setSelectedId(deviceId);
      }
      runRef.current = { deviceId, idx: 0, failures: 0, busy: false };
      setReplay({ deviceId, idx: 0, total: 0 });
      await tickReplay();
    } finally {
      startingRef.current = false;
    }
  }, [selectedId, refresh, tickReplay]);

  const pair = useCallback(
    async (code: string) => {
      const result = await claimCollar(code);
      if (result.result === "paired" || result.result === "already_yours") {
        await refresh();
        if (result.deviceId) setSelectedId(result.deviceId);
      }
      return result;
    },
    [refresh],
  );

  const rename = useCallback(async (id: string, label: string) => {
    await renameCollar(id, label);
    setCollars((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (runRef.current?.deviceId === id) stopReplay();
      await unpairCollar(id);
      await refresh();
    },
    [refresh, stopReplay],
  );

  const selected = collars.find((c) => c.id === selectedId) ?? null;
  const pairOfSelected = (selectedId && latestById[selectedId]) || EMPTY_PAIR;
  const state = collarState({
    device: selected,
    latest: pairOfSelected.latest,
    latestReal: pairOfSelected.latestReal,
    replayingHere: replay !== null && replay.deviceId === selectedId,
    now,
  });

  const value = useMemo<CollarLiveValue>(
    () => ({
      loading,
      collars,
      selected,
      select: setSelectedId,
      latest: pairOfSelected.latest,
      latestReal: pairOfSelected.latestReal,
      state,
      now,
      realtime,
      replay,
      replayError,
      startReplay,
      stopReplay,
      refresh,
      pair,
      rename,
      remove,
    }),
    [loading, collars, selected, pairOfSelected, state, now, realtime, replay, replayError, startReplay, stopReplay, refresh, pair, rename, remove],
  );

  return <CollarLiveContext.Provider value={value}>{children}</CollarLiveContext.Provider>;
}
