"use client";
import { useCallback, useEffect, useState } from "react";
import { loadDeviceWalks, startWalk, stopWalk, walkErrorKey, type DeviceWalks, type WalkErrorKey } from "@/lib/collar/walks";

/** How often /collar asks for the collar's walks: the Pi reports every 15 s. */
export const DEVICE_WALKS_POLL_MS = 15_000;

/** The owner's walks on one collar: the running one, the last 3, and Start/Stop. */
export function useDeviceWalks(deviceId: string) {
  const [walks, setWalks] = useState<DeviceWalks | null>(null);
  const [error, setError] = useState<WalkErrorKey | null>(null);
  const [dropped, setDropped] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setWalks(await loadDeviceWalks(deviceId));
    } catch {
      // Keep what is on screen; the next poll tries again.
    }
  }, [deviceId]);

  useEffect(() => {
    setWalks(null);
    setError(null);
    setDropped(false);
    void refresh();
    const timer = setInterval(() => void refresh(), DEVICE_WALKS_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setDropped(false);
    try {
      await run();
    } catch (e) {
      setError(walkErrorKey(e));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return {
    walks,
    error,
    dropped,
    busy,
    start: () => act(async () => {
      await startWalk(deviceId);
    }),
    stop: (walkId: string) => act(async () => {
      if ((await stopWalk(walkId)) === "dropped") setDropped(true);
    }),
  };
}
