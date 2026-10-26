"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { areaCircles, countByCity, type AreaCircle } from "@/lib/areaCounts";

/** sitter_counts_by_city() is not in the generated types until they are regenerated after its migration. */
interface CountsRpc {
  rpc(fn: "sitter_counts_by_city"): PromiseLike<{ data: { city: string; sitters: number }[] | null; error: unknown }>;
}

/**
 * Sitters per city for the map, at or above the privacy floor. Reads the counts-only database
 * function (migration 20261026200000); until that is live, counts the city column of the sitter
 * profiles the visitor can already read. Never a row about a person reaches the map: only totals.
 */
export function useSitterAreas(enabled = true): AreaCircle[] {
  const [areas, setAreas] = useState<AreaCircle[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    (async () => {
      const rpc = await (supabase as unknown as CountsRpc).rpc("sitter_counts_by_city");
      let counts;
      if (!rpc.error && Array.isArray(rpc.data)) {
        counts = countByCity([], rpc.data);
      } else {
        const { data } = await supabase.from("profiles").select("city").eq("is_sitter", true).is("deleted_at", null);
        counts = countByCity(data ?? []);
      }
      if (live) setAreas(areaCircles(counts));
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);
  return areas;
}
