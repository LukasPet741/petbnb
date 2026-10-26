"use client";
import dynamic from "next/dynamic";

/** Leaflet touches window on import, so the map only ever loads in the browser. */
const LazyPlacesMap = dynamic(() => import("@/components/partners/PlacesMap"), { ssr: false });

export default LazyPlacesMap;
