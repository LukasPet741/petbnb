"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { lookupPlace } from "@/lib/collar/placeName";
import type { CollarPosition } from "@/lib/collar/types";

/** The place under the collar ("Vingio parkas"), or null while unknown or unavailable. */
export function usePlaceName(position: CollarPosition | null): string | null {
  const { locale } = useLanguage();
  const [name, setName] = useState<string | null>(null);
  const lat = position?.lat;
  const lng = position?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let active = true;
    void lookupPlace(lat, lng, locale).then((found) => {
      if (active) setName(found);
    });
    return () => {
      active = false;
    };
  }, [lat, lng, locale]);

  return position ? name : null;
}
