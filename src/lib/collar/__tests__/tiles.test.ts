import { describe, it, expect } from "vitest";
import { tilesAround, worldPixel, TILE_SIZE } from "@/lib/collar/tiles";

describe("worldPixel", () => {
  it("puts 0,0 in the middle of the single zoom-0 tile", () => {
    const { x, y } = worldPixel(0, 0, 0);
    expect(x).toBeCloseTo(128, 6);
    expect(y).toBeCloseTo(128, 6);
  });
});

describe("tilesAround", () => {
  const VINGIS = { lat: 54.683, lng: 25.233 };

  it("includes the tile that contains the point (Vingis Park, zoom 15)", () => {
    const tiles = tilesAround(VINGIS.lat, VINGIS.lng, 15, 320, 56);
    const home = tiles.find((t) => t.dx <= 0 && t.dx + TILE_SIZE > 0 && t.dy <= 0 && t.dy + TILE_SIZE > 0);
    expect(home?.url).toMatch(/\/15\/18680\/10414\.png$/);
  });

  it("covers the whole box around the point", () => {
    const tiles = tilesAround(VINGIS.lat, VINGIS.lng, 16, 320, 56);
    expect(Math.min(...tiles.map((t) => t.dx))).toBeLessThanOrEqual(-160);
    expect(Math.max(...tiles.map((t) => t.dx + TILE_SIZE))).toBeGreaterThanOrEqual(160);
    expect(Math.min(...tiles.map((t) => t.dy))).toBeLessThanOrEqual(-28);
    expect(Math.max(...tiles.map((t) => t.dy + TILE_SIZE))).toBeGreaterThanOrEqual(28);
  });

  it("only uses the a/b/c tile hosts the CSP allows", () => {
    for (const tile of tilesAround(VINGIS.lat, VINGIS.lng, 16, 320, 56)) {
      expect(tile.url).toMatch(/^https:\/\/[abc]\.tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/);
    }
  });

  it("wraps tile columns across the antimeridian", () => {
    for (const tile of tilesAround(0, 179.99, 2, 320, 56)) {
      const x = Number(tile.url.split("/")[4]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(4);
    }
  });
});
