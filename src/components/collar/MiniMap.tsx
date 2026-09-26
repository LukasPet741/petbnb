"use client";
import { tilesAround } from "@/lib/collar/tiles";
import { cn } from "@/lib/utils";

/** Covers cards up to this wide; wider cards would show the grey background at the edges. */
const COVER_WIDTH = 320;

/** A static OpenStreetMap snapshot with the collar in the middle, for the sidebar card. */
export default function MiniMap({
  lat, lng, height, zoom = 16, muted = false, className,
}: {
  lat: number;
  lng: number;
  height: number;
  zoom?: number;
  muted?: boolean;
  className?: string;
}) {
  const tiles = tilesAround(lat, lng, zoom, COVER_WIDTH, height);
  return (
    <div className={cn("relative w-full overflow-hidden bg-[#e7ece6]", className)} style={{ height }} aria-hidden="true">
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          width={256}
          height={256}
          loading="lazy"
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            left: `calc(50% + ${tile.dx}px)`,
            top: `calc(50% + ${tile.dy}px)`,
            filter: muted ? "grayscale(1) opacity(0.55)" : "saturate(0.6)",
          }}
        />
      ))}
      <span data-dot className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2">
        {!muted && <span className="absolute inset-0 animate-ping rounded-full bg-amber opacity-50" />}
        <span className={cn("relative block h-full w-full rounded-full shadow ring-2 ring-white", muted ? "bg-[#8a948f]" : "bg-amber")} />
      </span>
    </div>
  );
}
