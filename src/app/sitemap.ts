import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * The pages worth indexing: the landing page and the two legal documents. Login and signup
 * are deliberately absent — they are crawlable but carry no content, so listing them would
 * only spend crawl budget. Everything behind the login wall is excluded by robots.ts, and
 * since 2026-09-15 that includes every sitter page: the public directory at /sitters was
 * removed when finding sitters started to need an account.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The deploy is the only thing that changes these pages, so the build time is a
  // truthful lastModified for them.
  const builtAt = new Date();

  return [
    { url: siteUrl("/"), lastModified: builtAt, changeFrequency: "weekly", priority: 1 },
    { url: siteUrl("/legal/terms"), lastModified: builtAt, changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl("/legal/privacy"), lastModified: builtAt, changeFrequency: "yearly", priority: 0.3 },
  ];
}
