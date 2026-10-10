// Makes favicon.ico and apple-icon.png from src/app/icon.svg, the one source of the mark.
// Run it after changing the mark:  node scripts/brand-icons.mjs
// Uses sharp, which Next.js installs for image optimisation.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const app = (file) => path.join(root, "src/app", file);
const svg = fs.readFileSync(app("icon.svg"), "utf8");

// iOS rounds an icon's corners itself, so the Apple icon is the full square.
const square = svg.replace('rx="28"', 'rx="0"');
if (square === svg) throw new Error('icon.svg no longer has the tile\'s rx="28": update this script');
await sharp(Buffer.from(square), { density: 600 }).resize(180, 180).png().toFile(app("apple-icon.png"));

// favicon.ico for clients that still ask for /favicon.ico: 16, 32 and 48 px PNGs in one
// ICO file (a 6-byte header, a 16-byte entry per image, then the images).
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((s) => sharp(Buffer.from(svg), { density: 600 }).resize(s, s).png().toBuffer()),
);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(pngs.length, 4);
let offset = header.length + 16 * pngs.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i], 0); // width
  e.writeUInt8(sizes[i], 1); // height
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
fs.writeFileSync(app("favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
console.log("wrote src/app/apple-icon.png and src/app/favicon.ico");
