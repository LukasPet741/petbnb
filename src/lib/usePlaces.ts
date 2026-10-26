"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ALL_PLACES, type Partner } from "@/lib/partners";
import { fetchPlaces, type PlacesClient } from "@/lib/placesDb";

/**
 * Every place on the map: the built-in list at once (so the first paint and the server render
 * have pins), then the places tables' rows once they answer. A failed or empty read keeps the
 * built-in list, so the map never goes blank.
 */
export function usePlaces(): Partner[] {
  const [places, setPlaces] = useState<Partner[]>(ALL_PLACES);
  useEffect(() => {
    let live = true;
    // The places tables are not in the generated types yet; see PlacesClient.
    fetchPlaces(supabase as unknown as PlacesClient).then((rows) => {
      if (live && rows) setPlaces(rows);
    });
    return () => {
      live = false;
    };
  }, []);
  return places;
}
