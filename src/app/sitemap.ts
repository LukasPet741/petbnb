import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * The one page meant for search results: the landing page (Lukas, 2026-09-15). Everything else,
 * the legal documents included, is served with `X-Robots-Tag: noindex` (next.config.ts), so
 * listing it here would only contradict that.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The deploy is the only thing that changes the page, so the build time is a truthful
  // lastModified for it.
  return [{ url: siteUrl("/"), lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
