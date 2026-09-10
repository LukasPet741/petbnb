/**
 * The origin this deployment serves from, without a trailing slash.
 *
 * Production is petbnb.lt (see the deployment notes: Vercel builds it straight from
 * main). NEXT_PUBLIC_SITE_URL overrides it, which is what makes `next build` locally
 * emit localhost URLs in the sitemap instead of claiming to be production — the
 * variable is http://localhost:3000 in .env.local for exactly that reason.
 *
 * Anything that has to be an absolute URL — metadataBase, robots, sitemap — goes
 * through here rather than hardcoding the domain in three places.
 */
const PRODUCTION_ORIGIN = "https://petbnb.lt";

function resolveOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (!configured) return PRODUCTION_ORIGIN;

  // A localhost origin is correct for `next dev` and catastrophic in a deployed
  // sitemap, which would then advertise 29 URLs nobody can fetch. .env.local holds
  // exactly that value, so treat it as a local-only setting: on Vercel the canonical
  // domain wins no matter what the variable says.
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(configured);
  if (isLoopback && process.env.VERCEL) return PRODUCTION_ORIGIN;

  return configured;
}

/** Server-only: reads VERCEL, which does not exist in the browser bundle. */
export const SITE_ORIGIN = resolveOrigin();

/** Absolute URL for a site-root-relative path. */
export function siteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Routes behind the login wall. They are real URLs, so a crawler can reach them and
 * be served an empty client shell; none of them have anything to index. Kept here so
 * robots.txt and any future noindex share one list.
 */
export const PRIVATE_ROUTE_PREFIXES = [
  "/bookings",
  "/browse",
  "/dashboard",
  "/messages",
  "/pets",
  "/profile",
  "/saved",
] as const;
