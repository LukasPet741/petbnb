"use client";
import { useEffect, useState } from "react";
import { WALK_REPLAY_MS, type WalkPoint } from "@/lib/collar/walks";

/**
 * A saved walk played back in the browser: the index of the point the dot is on, one step every
 * WALK_REPLAY_MS, then null again so the whole route shows. Nothing is written anywhere — unlike
 * the demo collar's recorded walk, which goes through the database (CollarLiveContext).
 */
export function useWalkReplay(points: WalkPoint[]) {
  const [index, setIndex] = useState<number | null>(null);
  const last = points.length - 1;

  useEffect(() => {
    if (index === null) return;
    const timer = setTimeout(() => setIndex(index >= last ? null : index + 1), WALK_REPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, last]);

  return {
    index,
    play: () => setIndex(points.length > 0 ? 0 : null),
    stop: () => setIndex(null),
  };
}
