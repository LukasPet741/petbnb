"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Literal hex, not var(--token) — Leaflet's SVG renderer writes stroke/fill
// as presentation attributes, which don't resolve CSS custom properties.
// Keep these in sync with globals.css.
const BRAND = "#1f5c47"; // --brand — the solid walked-route line
const AMBER = "#dc9a35"; // --amber — live position + waypoint dots
const SLATE = "#3f6472"; // --slate — route casing / the collar system's own "instrument" accent

let pulseStyleInjected = false;
function ensureMarkerStyles() {
  if (pulseStyleInjected || typeof document === "undefined") return;
  pulseStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes collar-live-pulse {
      0% { transform: scale(0.7); opacity: 0.5; }
      75%, 100% { transform: scale(2.4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Custom branded marker replacing Leaflet's default pin. This always marks
// the collar's *live* position, so it reads as a soft pulsing amber dot
// rather than a generic map pin — the one marker on the page allowed to use
// amber as a fill, since it needs to say "live" at a glance.
const liveMarkerIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:22px;height:22px;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:${AMBER};animation:collar-live-pulse 2.2s ease-out infinite;"></span>
      <span style="position:absolute;inset:6px;border-radius:9999px;background:${AMBER};box-shadow:0 0 0 2px #fff, 0 2px 6px rgb(19 26 23 / 0.35);"></span>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

interface CollarMapProps {
  lat: number;
  lng: number;
  label?: string;
  /** Optional trail of earlier points (oldest first) drawn as a line behind the marker. */
  path?: { lat: number; lng: number }[];
}

export default function CollarMap({ lat, lng, label, path }: CollarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const routeCasingRef = useRef<L.Polyline | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const waypointsRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureMarkerStyles();
    const map = L.map(containerRef.current, { attributionControl: false }).setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    // Two-stroke route: a wide, soft slate casing (the map "glows") underneath
    // a thinner solid pine line on top — the collar system's own register.
    routeCasingRef.current = L.polyline([], { color: SLATE, weight: 8, opacity: 0.25, lineCap: "round", lineJoin: "round" }).addTo(map);
    routeLineRef.current = L.polyline([], { color: BRAND, weight: 3, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(map);
    waypointsRef.current = L.layerGroup().addTo(map);
    markerRef.current = L.marker([lat, lng], { icon: liveMarkerIcon }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    if (label) markerRef.current.bindPopup(label);

    const trail = path ?? [];
    const points = trail.map((p): [number, number] => [p.lat, p.lng]);
    points.push([lat, lng]);
    routeCasingRef.current?.setLatLngs(points);
    routeLineRef.current?.setLatLngs(points);

    // Waypoint dots: a handful of small amber markers along the interior of
    // the trail (rest stops / direction changes), leaving the start and the
    // live position to the endpoints of the line itself.
    waypointsRef.current?.clearLayers();
    if (trail.length > 3 && waypointsRef.current) {
      const stride = Math.max(1, Math.floor(trail.length / 6));
      for (let i = stride; i < trail.length; i += stride) {
        L.circleMarker([trail[i].lat, trail[i].lng], {
          radius: 3.5,
          color: "#fff",
          weight: 1.5,
          fillColor: AMBER,
          fillOpacity: 1,
        }).addTo(waypointsRef.current);
      }
    }

    if (points.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 });
    } else {
      mapRef.current.panTo([lat, lng]);
    }
  }, [lat, lng, label, path]);

  return <div ref={containerRef} className="w-full h-full rounded-xl" />;
}
