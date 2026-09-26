"use client";
import { useEffect, useRef, useState } from "react";
import { loadPositions } from "@/lib/collar/api";
import { dayBounds, todayInputValue } from "@/lib/collar/stats";
import type { CollarPosition } from "@/lib/collar/types";

type Mode = "today" | "day" | "replay";

function append(list: CollarPosition[], position: CollarPosition): CollarPosition[] {
  const last = list[list.length - 1];
  if (last && last.recorded_at === position.recorded_at && last.lat === position.lat && last.lng === position.lng) return list;
  return [...list, position];
}

/**
 * The route drawn on the map: today's real positions growing as new ones arrive; a replay's
 * points from its first one; or a picked day's route (live points do not touch it).
 */
export function useCollarTrail(
  deviceId: string | null,
  latest: CollarPosition | null,
  day: string | null,
  replaying = false,
): CollarPosition[] {
  const [trail, setTrail] = useState<CollarPosition[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const modeRef = useRef<Mode>("today");

  useEffect(() => {
    if (!deviceId) {
      setTrail([]);
      return;
    }
    let active = true;
    modeRef.current = day ? "day" : "today";
    const { from, to } = dayBounds(day ?? todayInputValue());
    loadPositions(deviceId, from, to, "collar")
      .then((rows) => {
        if (active) setTrail(rows);
      })
      .catch(() => {
        if (active) setTrail([]);
      });
    return () => {
      active = false;
    };
  }, [deviceId, day, reloadKey]);

  useEffect(() => {
    if (!latest || day || latest.device_id !== deviceId) return;
    if (latest.source === "replay") {
      const fresh = modeRef.current !== "replay";
      modeRef.current = "replay";
      setTrail((prev) => append(fresh ? [] : prev, latest));
      return;
    }
    if (modeRef.current === "replay") {
      // Live again after a replay: bring back today's real route.
      modeRef.current = "today";
      setReloadKey((k) => k + 1);
      return;
    }
    setTrail((prev) => append(prev, latest));
  }, [latest, deviceId, day]);

  // A replay that ends with no real position since (indoors) must not leave its route on the map.
  useEffect(() => {
    if (!replaying && modeRef.current === "replay") {
      modeRef.current = "today";
      setReloadKey((k) => k + 1);
    }
  }, [replaying]);

  return trail;
}
