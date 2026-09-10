import type { MetadataRoute } from "next";
import { SITE_ORIGIN, PRIVATE_ROUTE_PREFIXES, siteUrl } from "@/lib/site";

/**
 * Everything public is crawlable; everything behind the login wall is not.
 *
 * The private routes are client shells that render nothing until Supabase answers,
 * so a crawler that fetched them would index an empty page under a real URL. The
 * login and signup pages stay crawlable but carry `robots: { index: false }` in
 * their own metadata: they are linked from the public pages, and a disallow here
 * would turn those links into crawl errors rather than a quiet skip.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Bare prefixes, not `/bookings/`: a trailing slash would leave the segment
      // itself (`/bookings`) crawlable and only block what sits under it.
      disallow: [...PRIVATE_ROUTE_PREFIXES],
    },
    sitemap: siteUrl("/sitemap.xml"),
    host: SITE_ORIGIN,
  };
}
