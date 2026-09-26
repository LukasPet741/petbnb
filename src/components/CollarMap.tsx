"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Minus, Plus } from "lucide-react";

// Literal hex, not var(--token) — Leaflet's SVG renderer writes stroke/fill
// as presentation attributes, which don't resolve CSS custom properties.
// Keep these in sync with globals.css.
const BRAND = "#1f5c47"; // --brand — the solid walked-route line
const AMBER = "#dc9a35"; // --amber — live position + waypoint dots
const SLATE = "#3f6472"; // --slate — route casing / the collar system's own "instrument" accent
const STALE = "#8a948f"; // a position the collar is no longer reporting

const GLIDE_MS = 800;

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

// The collar's position: a soft pulsing amber dot while live — the one marker on the page allowed
// to use amber as a fill, since it needs to say "live" at a glance — and a still grey dot once the
// collar stopped reporting.
function markerIcon(stale: boolean) {
  const colour = stale ? STALE : AMBER;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:22px;height:22px;">
        ${stale ? "" : `<span style="position:absolute;inset:0;border-radius:9999px;background:${colour};animation:collar-live-pulse 2.2s ease-out infinite;"></span>`}
        <span style="position:absolute;inset:6px;border-radius:9999px;background:${colour};box-shadow:0 0 0 2px #fff, 0 2px 6px rgb(19 26 23 / 0.35);"></span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

interface CollarMapProps {
  lat: number;
  lng: number;
  label?: string;
  /** Earlier points (oldest first) drawn as a line behind the marker. */
  path?: { lat: number; lng: number }[];
  /** False while the collar has never reported a position. */
  showMarker?: boolean;
  /** Grey, still marker for a collar that went offline. */
  stale?: boolean;
  /** Changing this refits the view to the path (another collar, another day, a replay). */
  fitKey?: string;
  /** Labels for the glass zoom/locate buttons; omitted, there are none. */
  controls?: { zoomIn: string; zoomOut: string; locate: string };
}

export default function CollarMap({ lat, lng, label, path, showMarker = true, stale = false, fitKey, controls }: CollarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const routeCasingRef = useRef<L.Polyline | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const waypointsRef = useRef<L.LayerGroup | null>(null);
  const fittedKeyRef = useRef<string | undefined>(undefined);
  const glideRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureMarkerStyles();
    const map = L.map(containerRef.current, { zoomControl: false }).setView([lat, lng], 15);
    map.attributionControl.setPrefix(false);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    // Two-stroke route: a wide, soft slate casing (the map "glows") underneath
    // a thinner solid pine line on top — the collar system's own register.
    routeCasingRef.current = L.polyline([], { color: SLATE, weight: 8, opacity: 0.25, lineCap: "round", lineJoin: "round" }).addTo(map);
    routeLineRef.current = L.polyline([], { color: BRAND, weight: 3, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(map);
    waypointsRef.current = L.layerGroup().addTo(map);
    markerRef.current = L.marker([lat, lng], { icon: markerIcon(stale) });
    mapRef.current = map;
    return () => {
      if (glideRef.current) cancelAnimationFrame(glideRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    markerRef.current?.setIcon(markerIcon(stale));
  }, [stale]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    if (showMarker) {
      if (!map.hasLayer(marker)) marker.setLatLng([lat, lng]).addTo(map);
      // Glide to the new position instead of jumping, so the dot reads as a moving dog.
      const from = marker.getLatLng();
      const start = performance.now();
      if (glideRef.current) cancelAnimationFrame(glideRef.current);
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / GLIDE_MS);
        marker.setLatLng([from.lat + (lat - from.lat) * k, from.lng + (lng - from.lng) * k]);
        if (k < 1) glideRef.current = requestAnimationFrame(step);
      };
      glideRef.current = requestAnimationFrame(step);
      if (label) marker.bindPopup(label);
    } else if (map.hasLayer(marker)) {
      marker.remove();
    }

    const trail = path ?? [];
    const points = trail.map((p): [number, number] => [p.lat, p.lng]);
    if (showMarker) points.push([lat, lng]);
    routeCasingRef.current?.setLatLngs(points);
    routeLineRef.current?.setLatLngs(points);

    // Waypoint dots: a handful of small amber markers along the interior of the trail.
    waypointsRef.current?.clearLayers();
    if (trail.length > 3 && waypointsRef.current) {
      const stride = Math.max(1, Math.floor(trail.length / 6));
      for (let i = stride; i < trail.length; i += stride) {
        L.circleMarker([trail[i].lat, trail[i].lng], {
          radius: 3.5, color: "#fff", weight: 1.5, fillColor: AMBER, fillOpacity: 1,
        }).addTo(waypointsRef.current);
      }
    }

    // Fit once per fitKey; afterwards only follow the collar if it walks out of view, so a
    // presenter who zoomed in is not yanked back every 15 seconds.
    if (fittedKeyRef.current !== fitKey) {
      fittedKeyRef.current = fitKey;
      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 17 });
      else map.setView([lat, lng], 16);
    } else if (showMarker && !map.getBounds().pad(-0.15).contains([lat, lng])) {
      map.panTo([lat, lng]);
    }
  }, [lat, lng, label, path, showMarker, fitKey]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {/* Not on phones: fingers pinch to zoom, and the state cards there need the whole map. */}
      {controls && (
        <div className="glass-panel absolute right-4 top-4 z-[800] hidden flex-col rounded-[14px] border p-0.5 sm:flex">
          <button type="button" aria-label={controls.zoomIn} onClick={() => mapRef.current?.zoomIn()} className="grid h-9 w-9 place-items-center text-ink-soft hover:text-ink">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label={controls.zoomOut} onClick={() => mapRef.current?.zoomOut()} className="grid h-9 w-9 place-items-center border-t border-ink/8 text-ink-soft hover:text-ink">
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label={controls.locate} onClick={() => mapRef.current?.setView([lat, lng], Math.max(16, mapRef.current.getZoom()))} className="grid h-9 w-9 place-items-center border-t border-ink/8 text-ink-soft hover:text-ink">
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
