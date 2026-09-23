import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { busyMap, type BusyKind } from "@/lib/availability";

/**
 * The days a sitter is taken between two dates, from the sitter_busy_days RPC: one call per
 * sitter and range, never one per day. Says a day is taken and whether by a day off or an
 * accepted booking; never by whom.
 *
 * A failed read renders as "all free" rather than an error: the calendar is a courtesy, and
 * the database still refuses a clashing request (enforce_sitter_availability).
 */
export function useBusyDays(sitterId: string | null, from: string, to: string) {
  const [busy, setBusy] = useState<Map<string, BusyKind>>(() => new Map());
  const [loading, setLoading] = useState(Boolean(sitterId));
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!sitterId) {
      setBusy(new Map());
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .rpc("sitter_busy_days", { p_sitter: sitterId, p_from: from, p_to: to })
      .then(({ data }) => {
        if (!active) return;
        const rows = (data ?? []).map((r) => ({ day: r.day, kind: (r.kind === "booked" ? "booked" : "off") as BusyKind }));
        setBusy(busyMap(rows));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sitterId, from, to, tick]);

  return { busy, reload, loading };
}
