// Fetches each place's logo from its own website and re-encodes it as a PNG under /public.
//
//   node scripts/place-logos.mjs [slug ...]
//
// Partners (they agreed to show their logo) → public/partners/<slug>.png. Listed places →
// public/places/<slug>.png: the icon the business itself publishes on its site, shown only to
// identify it, next to "Not a partner yet".
//
// Every image is decoded and re-encoded by sharp: an SVG becomes a PNG (a third-party SVG served
// from petbnb.lt could run script), metadata is dropped, anything that is not a real image of a
// usable size is skipped. Raw downloads stay in the OS temp folder, never in the repo.
// Writes scripts/place-logos.json (what was chosen, from where) for the contact sheet and data.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const UA = "Mozilla/5.0 (compatible; petbnb-logo/1.0; thesis prototype)";
const RAW = path.join(os.tmpdir(), "petbnb-logos-raw");
const MIN = 48;
const MAX_BYTES = 3_000_000;
fs.mkdirSync(RAW, { recursive: true });

const readJsonArray = (file) => {
  const ts = fs.readFileSync(file, "utf8");
  return JSON.parse(ts.slice(ts.indexOf("= [") + 2, ts.lastIndexOf("]") + 1));
};

// Partners are typed by hand in partners.ts; their sites are listed here.
const partners = [
  { slug: "dogiday", website: "https://dogiday.lt", partner: true },
  { slug: "dogpunk", website: "https://mokyksuni.lt/", partner: true },
];
const listed = readJsonArray("src/lib/listedPlaces.ts")
  .filter((p) => p.website)
  .map((p) => ({ slug: p.slug, website: p.website, partner: false }));
const only = new Set(process.argv.slice(2));
const targets = [...partners, ...listed].filter((t) => only.size === 0 || only.has(t.slug));

const timeout = (ms) => AbortSignal.timeout(ms);

async function get(url, ms = 12_000) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: timeout(ms) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res;
}

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(2).find((v) => v != null);

/** Logo candidates in the page, best first. */
function candidates(html, base) {
  const out = [];
  const add = (href, kind, score) => {
    if (!href || href.startsWith("data:")) return;
    try {
      out.push({ url: new URL(href.trim(), base).toString(), kind, score });
    } catch {}
  };
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const hay = [attr(tag, "class"), attr(tag, "id"), attr(tag, "alt"), attr(tag, "src")].join(" ").toLowerCase();
    if (!/logo/.test(hay)) continue;
    const src = attr(tag, "src") ?? attr(tag, "data-src") ?? attr(tag, "srcset")?.split(/[\s,]+/)[0];
    add(src, "logo-img", 100);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (rel.includes("apple-touch-icon")) add(href, "apple-touch-icon", 80);
    else if (/\bicon\b/.test(rel)) {
      const size = Number((attr(tag, "sizes") ?? "").split("x")[0]) || 0;
      add(href, `icon-${size || "any"}`, 40 + Math.min(size, 256) / 8);
    }
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (/og:image/i.test(attr(tag, "property") ?? attr(tag, "name") ?? "")) add(attr(tag, "content"), "og-image", 20);
  }
  add("/apple-touch-icon.png", "apple-touch-icon-guess", 30);
  return out.sort((a, b) => b.score - a.score).filter((c, i, all) => all.findIndex((d) => d.url === c.url) === i);
}

async function fetchImage(url) {
  const res = await get(url, 10_000);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES || buf.length < 100) throw new Error(`size ${buf.length}`);
  const meta = await sharp(buf, { density: 300 }).metadata();
  if (!["png", "jpeg", "webp", "gif", "svg"].includes(meta.format)) throw new Error(`format ${meta.format}`);
  if ((meta.width ?? 0) < MIN || (meta.height ?? 0) < MIN) throw new Error(`small ${meta.width}x${meta.height}`);
  return { buf, meta };
}

async function encode(buf, out) {
  let img = sharp(buf, { density: 300 }).ensureAlpha();
  try {
    img = sharp(await img.trim({ threshold: 12 }).toBuffer());
  } catch {}
  await img.resize(256, 256, { fit: "inside" }).png({ compressionLevel: 9 }).toFile(out);
}

const report = [];
for (const t of targets) {
  const dir = t.partner ? "public/partners" : "public/places";
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${t.slug}.png`);
  let chosen = null;
  const tried = [];
  try {
    const page = await get(t.website);
    const html = (await page.text()).slice(0, 2_000_000);
    for (const c of candidates(html, page.url)) {
      try {
        const { buf, meta } = await fetchImage(c.url);
        fs.writeFileSync(path.join(RAW, `${t.slug}-${c.kind}`), buf);
        await encode(buf, out);
        chosen = { ...c, width: meta.width, height: meta.height, format: meta.format };
        break;
      } catch (e) {
        tried.push(`${c.kind}: ${e.message}`);
      }
    }
  } catch (e) {
    tried.push(`page: ${e.message}`);
  }
  report.push({ slug: t.slug, partner: t.partner, website: t.website, logo: chosen ? `/${path.relative("public", out).replace(/\\/g, "/")}` : null, source: chosen, tried });
  console.log(`${chosen ? "✓" : "✗"} ${t.slug} ${chosen ? `${chosen.kind} ${chosen.width}x${chosen.height} ${chosen.format}` : tried.slice(-2).join("; ")}`);
}
fs.writeFileSync("scripts/place-logos.json", JSON.stringify(report, null, 2) + "\n");
console.log(`${report.filter((r) => r.logo).length}/${report.length} logos`);
