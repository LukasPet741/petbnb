import type { NextConfig } from "next";
import path from "path";

/**
 * The Supabase project origin, for the two CSP directives that have to name it: the
 * REST and realtime endpoints under connect-src, and the storage bucket that serves
 * avatars and pet photos under img-src.
 *
 * Read from the environment rather than hard-coded so preview and production point at
 * whatever they are configured for. If the variable is missing the origin is simply
 * left out — a CSP with a hole in it is better than one containing the string
 * "undefined", which would silently match nothing and break every image and query.
 */
function supabaseOrigins(): { http: string[]; ws: string[] } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { http: [], ws: [] };
  try {
    const { origin, host } = new URL(raw);
    return { http: [origin], ws: [`wss://${host}`] };
  } catch {
    return { http: [], ws: [] };
  }
}

const { http: supabaseHttp, ws: supabaseWs } = supabaseOrigins();

/**
 * Content-Security-Policy.
 *
 * What this genuinely buys, and what it does not:
 *
 * - frame-ancestors 'none' ends the clickjacking exposure on /login. Nothing here is
 *   meant to be framed by anyone.
 * - connect-src is the valuable half. The Supabase session token lives in
 *   localStorage, so an injected script's payoff is posting it somewhere. This limits
 *   outbound fetch/XHR/WebSocket to this origin and the Supabase project.
 * - script-src still carries 'unsafe-inline', so this is NOT full XSS protection.
 *   The App Router inlines its hydration payload as <script>self.__next_f.push(...)>,
 *   which without a nonce cannot be distinguished from an injected inline script.
 *   Nonces need a middleware that stamps every request, and this project has no
 *   middleware at all; adding one also opts every route out of static optimisation.
 *   That is a deliberate, separate decision, not an oversight. Until then this blocks
 *   external script sources and exfiltration but not inline injection.
 * - style-src needs 'unsafe-inline' for real: framer-motion animates via inline style
 *   attributes and Leaflet injects its own.
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  // randomuser.me serves 24 of the 25 seed sitter avatars and unsplash the rest,
  // and both are stored as absolute URLs in profiles.avatar_url / pets.photo_url
  // rather than written anywhere in this repo -- grepping the source for origins
  // misses them entirely, and a CSP without them blanks every avatar on /sitters.
  // Drop randomuser.me once the seed profiles carry real uploads, which land in
  // the Supabase storage bucket already covered below.
  `img-src 'self' data: blob: https://images.unsplash.com https://randomuser.me https://*.tile.openstreetmap.org ${supabaseHttp.join(" ")}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${[...supabaseHttp, ...supabaseWs].join(" ")}`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Redundant with frame-ancestors for modern browsers, kept for the ones that only
  // understand this.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in the app asks for any of these; CollarMap draws positions the collar
  // reported to the database, it never reads the visitor's own location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Left off deliberately: Cross-Origin-Opener-Policy and COEP. They buy cross-origin
  // isolation this app has no use for, and COEP breaks third-party images unless every
  // one of them sends CORP.
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  turbopack: {
    // A stray C:\Users\lkspe\package-lock.json makes Next.js infer the wrong
    // workspace root — pin it explicitly to this project.
    root: path.join(__dirname),
  },
  async redirects() {
    return [
      // /terms was the single legal page before the documents were split into
      // /legal/{terms,privacy}. Redirects are checked ahead of the filesystem,
      // so bookmarks and anything already linking to the old path still land.
      { source: "/terms", destination: "/legal/terms", permanent: true },
    ];
  },
};

export default nextConfig;
