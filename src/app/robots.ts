import type { MetadataRoute } from "next";
import { SITE_ORIGIN, siteUrl } from "@/lib/site";

/**
 * Crawlers may fetch everything; only the landing page may be indexed (Lukas, 2026-09-15).
 *
 * Nothing is disallowed on purpose. A Disallow does not take a page out of Google: a blocked
 * URL it already knows can still be listed, and a blocked crawl never sees the page's noindex.
 * Instead every path but "/" answers with `X-Robots-Tag: noindex` (next.config.ts), which a
 * crawler has to be allowed to fetch in order to obey.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: siteUrl("/sitemap.xml"),
    host: SITE_ORIGIN,
  };
}
