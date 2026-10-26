"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPlace } from "@/lib/partners";
import type { AreaCircle } from "@/lib/areaCounts";

// Leaflet writes colours as SVG presentation attributes, which don't resolve var(--token), so the
// brand green is read from the stylesheet once the map mounts (and follows the dark theme).
function brandColour() {
  return getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
}

/**
 * A city's sitter count: a soft amber disc with the number, in amber (the app's colour for
 * people and the live collar). Pixel-sized, so it reads at a country zoom, where a circle in
 * metres would shrink to a dot. An HTML icon, so the colour tokens resolve.
 */
function areaIcon(count: number) {
  const size = Math.round(30 + Math.sqrt(count) * 6);
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:color-mix(in srgb, var(--amber) 28%, white);box-shadow:0 1px 4px rgb(19 26 23 / 0.25);border:2px solid var(--amber);color:var(--amber-strong);font-weight:700;font-size:13px;line-height:1;">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2 - 2],
  });
}

/** All of Lithuania, for a map with nothing on it yet. */
const LITHUANIA: L.LatLngTuple = [55.2, 23.9];

// lucide's paw-print, inlined: a divIcon takes an HTML string, not a component.
const PAW = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>`;

/** Leaflet sets a tooltip's text as HTML, and listed names come from OpenStreetMap: escape them. */
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Pins at or above this count open on the busiest city instead of the whole country. */
const MANY = 20;
/** "The busiest city": every pin within this many metres of the median pin. */
const CITY_RADIUS_M = 6_000;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * Where the map opens. A few pins: all of them. Many across several cities: the city around the
 * median pin (Vilnius, today), since a country view turns a hundred pins into two blobs. Zooming
 * out still shows the rest.
 */
function focusBounds(places: MapPlace[]): L.LatLngBounds {
  const all = L.latLngBounds(places.map((p) => [p.lat, p.lng] as L.LatLngTuple));
  if (places.length < MANY) return all;
  const centre = L.latLng(median(places.map((p) => p.lat)), median(places.map((p) => p.lng)));
  const near = places.filter((p) => centre.distanceTo([p.lat, p.lng]) <= CITY_RADIUS_M);
  return near.length >= 5 ? L.latLngBounds(near.map((p) => [p.lat, p.lng] as L.LatLngTuple)) : all;
}

/** A listed place (public information, not a partner): a small dot, so partners' paws stand out. */
function dotIcon(brand: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${brand};opacity:0.7;box-shadow:0 0 0 2px #fff,0 1px 4px rgb(19 26 23 / 0.3);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    tooltipAnchor: [0, -9],
  });
}

/** A partner with a logo: the logo on a white disc in a brand ring (dashed where only the area is known). */
function logoIcon(ring: string, logo: string, approximate: boolean) {
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:40px;height:40px;border-radius:9999px;background:#fff;border:3px ${approximate ? "dashed" : "solid"} ${ring};box-shadow:0 2px 8px rgb(19 26 23 / 0.35);overflow:hidden;"><img src="${escapeHtml(logo)}" alt="" style="width:28px;height:28px;object-fit:contain;" /></span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -23],
  });
}

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
 * Pet businesses on a map: a paw pin per partner address, a small dot per listed place, drawn pale in a dashed ring where only the
 * area is known (Dogiday's "Antakalnis"). A tap on a pin opens that partner, the same as its card.
 *
 * Businesses are points. People never are: sitters show only as a soft circle per city with a
 * count (the People layer, under the pins), and no one's home is ever a point on this map
 * (PetBnB ecosystem plan, "The map").
 *
 * Tiles are OpenStreetMap's, as on the collar map; a public map with real traffic moves to a tile
 * provider, since OSM's own servers are not for production use.
 */
export default function PlacesMap({
  places,
  onSelect,
  label,
  areas = [],
  areaLabel,
  adLabel = "Ad",
}: {
  places: MapPlace[];
  onSelect: (slug: string) => void;
  /** Names the map for assistive tech. */
  label: string;
  /** Sitters per city, already over the privacy floor; drawn as circles, never as pins. */
  areas?: AreaCircle[];
  /** The hover text of an area: "Vilnius: 6 sitters". */
  areaLabel?: (area: AreaCircle) => string;
  /** Said before a promoted place's name: paid placement is always labelled ("Reklama"). */
  adLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const areaLabelRef = useRef(areaLabel);
  areaLabelRef.current = areaLabel;
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
    areaLayerRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      areaLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = areaLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const area of areas) {
      const text = areaLabelRef.current?.(area) ?? "";
      const bubble = L.marker([area.lat, area.lng], {
        icon: areaIcon(area.count),
        title: text,
        keyboard: false,
        // Under every business pin: the count explains the city, the pins stay tappable.
        zIndexOffset: -1000,
      });
      if (text) bubble.bindTooltip(escapeHtml(text), { direction: "top" });
      bubble.addTo(layer);
    }
  }, [areas]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const brand = brandColour();

    for (const place of places) {
      const select = () => onSelectRef.current(place.slug);
      const pin = L.marker([place.lat, place.lng], {
        // A promoted place's ring is amber, and its name says it is an ad.
        icon: place.listed ? dotIcon(brand) : place.logo ? logoIcon(place.promoted ? "var(--amber)" : brand, place.logo, place.approximate) : pinIcon(brand, place.approximate),
        title: place.name,
        keyboard: true,
        // An exact address sits above an approximate area when the two overlap at a wide zoom.
        // Listed dots sit under every partner pin.
        zIndexOffset: place.listed ? -500 : place.promoted ? 800 : place.approximate ? 0 : 500,
      });
      pin.bindTooltip(escapeHtml(place.promoted ? `${adLabel} · ${place.name}` : place.name), { direction: "top" }).on("click", select).addTo(layer);
      // Enter on a focused pin opens it, like a click.
      pin.on("keypress", (e) => { if ((e.originalEvent as KeyboardEvent).key === "Enter") select(); });
    }

    if (places.length === 0) {
      map.setView(LITHUANIA, 7);
    } else {
      map.fitBounds(focusBounds(places), { padding: [48, 48], maxZoom: 13 });
    }
  }, [places]);

  return <div ref={containerRef} role="region" aria-label={label} className="h-full w-full" />;
}
