/**
 * OpenStreetMap tile maths for the sidebar's mini-map: which 256 px tiles cover a box around a
 * point, placed relative to the point, so the point sits in the middle of the box at whatever width
 * the card renders. No map library: this card is on every signed-in page. The CSP already allows
 * images from *.tile.openstreetmap.org (the a/b/c hosts Leaflet uses too).
 */
export const TILE_SIZE = 256;

const MAX_LAT = 85.05112878;

export function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const rad = (clamped * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale,
  };
}

export interface PlacedTile {
  key: string;
  url: string;
  /** The tile's top-left corner relative to the point, in px. */
  dx: number;
  dy: number;
}

export function tilesAround(lat: number, lng: number, zoom: number, width: number, height: number): PlacedTile[] {
  const { x, y } = worldPixel(lat, lng, zoom);
  const count = 2 ** zoom;
  const firstX = Math.floor((x - width / 2) / TILE_SIZE);
  const lastX = Math.floor((x + width / 2) / TILE_SIZE);
  const firstY = Math.max(0, Math.floor((y - height / 2) / TILE_SIZE));
  const lastY = Math.min(count - 1, Math.floor((y + height / 2) / TILE_SIZE));
  const tiles: PlacedTile[] = [];
  for (let ty = firstY; ty <= lastY; ty++) {
    for (let tx = firstX; tx <= lastX; tx++) {
      const wrapped = ((tx % count) + count) % count;
      const host = "abc"[(wrapped + ty) % 3];
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: `https://${host}.tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
        dx: Math.round(tx * TILE_SIZE - x),
        dy: Math.round(ty * TILE_SIZE - y),
      });
    }
  }
  return tiles;
}
