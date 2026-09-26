"use client";
import dynamic from "next/dynamic";

/** Leaflet touches window on import, so the map only ever loads in the browser. */
const LazyCollarMap = dynamic(() => import("@/components/CollarMap"), { ssr: false });

export default LazyCollarMap;
