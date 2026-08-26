"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icon references image URLs that don't resolve
// through Next's bundler; point them at the CDN copies instead.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
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
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { attributionControl: false }).setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    polylineRef.current = L.polyline([], { color: "#2F6F5E", weight: 3, opacity: 0.8 }).addTo(map);
    markerRef.current = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
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

    const points = (path ?? []).map((p): [number, number] => [p.lat, p.lng]);
    points.push([lat, lng]);
    polylineRef.current?.setLatLngs(points);

    if (points.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 });
    } else {
      mapRef.current.panTo([lat, lng]);
    }
  }, [lat, lng, label, path]);

  return <div ref={containerRef} className="w-full h-full rounded-xl" />;
}
