// The dots on the monitor's sphere: one per product feature.
//
// `routes` are pinged on the dev server (Sweep dev) and on prod. Signed out,
// the (app) routes answer with a redirect to /login — that counts as up.
// `match` decides which feature a changed file, failing test or type error
// belongs to; it is tested against the repo-relative path with forward slashes.
// Anything that matches nothing lands on the app shell.

export const FEATURES = [
  {
    id: "landing",
    label: "Landing",
    routes: ["/"],
    match: [/^src\/app\/page\./, /\/home\//, /hero|citygrid|sittervoices|landing|public(header|footer)/],
  },
  {
    id: "auth",
    label: "Auth",
    routes: ["/login", "/signup", "/forgot-password", "/reset-password"],
    match: [/login|signup|password|authshell|\/auth\./],
  },
  {
    id: "browse",
    label: "Browse sitters",
    routes: ["/browse"],
    match: [/browse|sitter(card|cover|mini)|sitter-/],
  },
  {
    id: "bookings",
    label: "Bookings & offers",
    routes: ["/bookings", "/bookings/new"],
    match: [/booking|offer|pric|availability/],
  },
  {
    id: "messages",
    label: "Messages",
    routes: ["/messages"],
    match: [/message|notification/],
  },
  {
    id: "pets",
    label: "Pets",
    routes: ["/pets", "/pets/new"],
    match: [/\/pets\/|pet(card|form|visuals|spage)|imageupload/],
  },
  {
    id: "profile",
    label: "Profile",
    routes: ["/profile"],
    match: [/profile|avatar|onboarding/],
  },
  {
    id: "saved",
    label: "Saved",
    routes: ["/saved"],
    match: [/saved|favorite/],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    routes: ["/dashboard"],
    match: [/dashboard|rightrail|tip(card|widget|s\b)|nextup|activityfeed/],
  },
  {
    id: "collar",
    label: "Collar",
    routes: ["/collar"],
    match: [/^src\/.*(collar|livedot|minimap)/],
  },
  {
    id: "smart-id",
    label: "Smart-ID",
    routes: ["/smart-id-demo", "/api/smart-id-demo"],
    match: [/smart-?id|verifiedseal|simulatedphone/],
  },
  {
    id: "reviews",
    label: "Reviews",
    routes: [],
    match: [/review|stars|starinput|ratingsummary/],
  },
  {
    id: "legal",
    label: "Legal",
    routes: ["/legal", "/legal/privacy", "/legal/terms"],
    match: [/legal/],
  },
  {
    id: "brand-identity",
    label: "Brand identity",
    routes: ["/brand", "/icon.svg", "/apple-icon.png", "/favicon.ico"],
    match: [/logo|\/brand|brand-icons|\/icon\.svg|apple-icon|favicon|opengraph/],
  },
  {
    id: "seo",
    label: "SEO & share",
    routes: ["/robots.txt", "/sitemap.xml"],
    match: [/robots|sitemap|opengraph/],
  },
  {
    id: "shell",
    label: "App shell & i18n",
    routes: [],
    match: [/layout\.tsx|globals\.css|sidebar|logo|atmosphere|i18n|motion|next\.config|proxy|middleware|statuspage/],
  },
  {
    id: "collar-hw",
    label: "Collar Pi",
    routes: [],
    match: [/^iot-collar\//],
  },
  {
    id: "backend",
    label: "Supabase",
    routes: [],
    match: [/^supabase\//],
  },
];

const FALLBACK = "shell";

/** Feature ids a repo path belongs to (never empty). */
export function featuresForPath(rawPath) {
  const path = rawPath.replaceAll("\\", "/").replace(/^\.\//, "");
  // The Pi and the database own their whole trees: a word like "collar" or
  // "booking" inside them must not light up the web feature of the same name.
  for (const id of ["collar-hw", "backend"]) {
    const f = FEATURES.find((x) => x.id === id);
    if (f.match.some((re) => re.test(path))) return [id];
  }
  const lower = path.toLowerCase();
  const hits = FEATURES.filter(
    (f) => f.id !== "collar-hw" && f.id !== "backend" && f.match.some((re) => re.test(lower)),
  ).map((f) => f.id);
  return hits.length ? hits : [FALLBACK];
}
