"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPlace } from "@/lib/partners";

// Leaflet writes colours as SVG presentation attributes, which don't resolve var(--token), so the
// brand green is read from the stylesheet once the map mounts (and follows the dark theme).
function brandColour() {
  return getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
}

/** All of Lithuania, for a map with nothing on it yet. */
const LITHUANIA: L.LatLngTuple = [55.2, 23.9];

// lucide's paw-print, inlined: a divIcon takes an HTML string, not a component.
const PAW = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>`;

/** A solid paw for an exact address; a pale one in a dashed ring where only the area is known. */
function pinIcon(brand: string, approximate: boolean) {
  const look = approximate
    ? `background:rgb(255 255 255 / 0.85);color:${brand};border:2px dashed ${brand};`
    : `background:${brand};color:#fff;box-shadow:0 0 0 3px #fff,0 2px 8px rgb(19 26 23 / 0.35);`;
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:9999px;${look}">${PAW}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    tooltipAnchor: [0, -20],
  });
}

/**
 * Partner businesses on a map: a paw pin per address, drawn pale in a dashed ring where only the
 * area is known (Dogiday's "Antakalnis"). A tap on a pin opens that partner, the same as its card.
 *
 * Businesses only. People are never drawn here: sitters will show as counts per area, and no
 * one's home is ever a point on this map (PetBnB ecosystem plan, "The map").
 *
 * Tiles are OpenStreetMap's, as on the collar map; a public map with real traffic moves to a tile
 * provider, since OSM's own servers are not for production use.
 */
export default function PlacesMap({
  places,
  onSelect,
  label,
}: {
  places: MapPlace[];
  onSelect: (slug: string) => void;
  /** Names the map for assistive tech. */
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // One finger scrolls the page on a phone; two pan and zoom the map. The wheel scrolls the
    // page too, so a map in the middle of a page never traps it.
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
    }).setView(LITHUANIA, 7);
    map.attributionControl.setPrefix(false);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const brand = brandColour();

    for (const place of places) {
      const select = () => onSelectRef.current(place.slug);
      const pin = L.marker([place.lat, place.lng], {
        icon: pinIcon(brand, place.approximate),
        title: place.name,
        keyboard: true,
        // An exact address sits above an approximate area when the two overlap at a wide zoom.
        zIndexOffset: place.approximate ? 0 : 500,
      });
      pin.bindTooltip(place.name, { direction: "top" }).on("click", select).addTo(layer);
      // Enter on a focused pin opens it, like a click.
      pin.on("keypress", (e) => { if ((e.originalEvent as KeyboardEvent).key === "Enter") select(); });
    }

    if (places.length === 0) {
      map.setView(LITHUANIA, 7);
    } else {
      const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    }
  }, [places]);

  return <div ref={containerRef} role="region" aria-label={label} className="h-full w-full" />;
}
