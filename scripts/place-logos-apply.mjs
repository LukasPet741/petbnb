// Applies scripts/place-logos.json (written by place-logos.mjs) to the listed places, after a look
// at the contact sheet:
//
//   node scripts/place-logos-apply.mjs
//
// - drops the logos that failed the review (REJECTED, with the reason), file and all;
// - gives each listed place its accepted logo (src/lib/listedPlaces.ts, "logo");
// - removes a website whose page could not be reached safely (expired or wrong TLS certificate,
//   dead domain), so "Visit website" never leads to a browser error.
// Partners' logos are set by hand in src/lib/partners.ts.

import fs from "node:fs";

const REJECTED = {
  divet: "white on transparent: invisible on a light card",
  "pet-city": "white on transparent: invisible on a light card",
  keturkojis: "a vet-registry badge, not their logo",
  "pethappy-lt": "a food brand they sell (Dibaq), not their logo",
  "zoofanai-lt": "a generic shopping cart",
};
// Sites that could not be reached safely on 2026-10-26 (fetch's error cause). A reset connection
// (ernista.lt) may be one bad moment, so it keeps its link.
const DEAD_SITES = {
  barbosas: "CERT_HAS_EXPIRED",
  "blusius-gyvunu-kirpykla": "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR",
  kaivana: "ERR_TLS_CERT_ALTNAME_INVALID",
  minivet: "ENOTFOUND",
};

const report = JSON.parse(fs.readFileSync("scripts/place-logos.json", "utf8"));
const FILE = "src/lib/listedPlaces.ts";
const ts = fs.readFileSync(FILE, "utf8");
const start = ts.indexOf("= [") + 2;
const end = ts.lastIndexOf("]") + 1;
const places = JSON.parse(ts.slice(start, end));

let logos = 0;
let dropped = 0;
for (const r of report) {
  if (r.logo && REJECTED[r.slug]) {
    fs.rmSync(`public${r.logo}`, { force: true });
    r.logo = null;
    r.rejected = REJECTED[r.slug];
  }
  if (r.partner) continue;
  const place = places.find((p) => p.slug === r.slug);
  if (!place) continue;
  if (r.logo) {
    place.logo = r.logo;
    logos++;
  } else delete place.logo;
  if (DEAD_SITES[r.slug] && place.website) {
    delete place.website;
    dropped++;
  }
}

fs.writeFileSync(FILE, ts.slice(0, start) + JSON.stringify(places, null, 2) + ts.slice(end));
fs.writeFileSync("scripts/place-logos.json", JSON.stringify(report, null, 2) + "\n");
console.log(`${logos} listed logos, ${dropped} unreachable websites removed`);
