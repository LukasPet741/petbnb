import type { CollarPosition } from "./types";

/** The newest position of a collar, and the newest one that came from the collar itself. */
export interface LatestPair {
  latest: CollarPosition | null;
  latestReal: CollarPosition | null;
}

export const EMPTY_PAIR: LatestPair = { latest: null, latestReal: null };

const isNewer = (candidate: CollarPosition, current: CollarPosition | null) =>
  !current || Date.parse(candidate.recorded_at) >= Date.parse(current.recorded_at);

/**
 * Folds one arriving position into the per-collar map. An older arrival (the Pi flushing its
 * offline queue) never replaces a newer position; the unchanged map is returned as-is.
 */
export function mergePosition(prev: Record<string, LatestPair>, position: CollarPosition): Record<string, LatestPair> {
  const current = prev[position.device_id] ?? EMPTY_PAIR;
  const latest = isNewer(position, current.latest) ? position : current.latest;
  const latestReal =
    position.source === "collar" && isNewer(position, current.latestReal) ? position : current.latestReal;
  if (latest === current.latest && latestReal === current.latestReal) return prev;
  return { ...prev, [position.device_id]: { latest, latestReal } };
}
