import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { siteUrl } from "@/lib/site";

/**
 * The pages worth indexing: the landing page, the sitter directory, every sitter
 * profile, and the two legal documents. Login and signup are deliberately absent —
 * they are crawlable but carry no content, so listing them would only spend crawl
 * budget. Everything behind the login wall is excluded by robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The deploy is the only thing that changes these pages, so the build time is a
  // truthful lastModified for them in a way it would not be for a sitter profile.
  const builtAt = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), lastModified: builtAt, changeFrequency: "weekly", priority: 1 },
    { url: siteUrl("/sitters"), lastModified: builtAt, changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/legal/terms"), lastModified: builtAt, changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl("/legal/privacy"), lastModified: builtAt, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [...staticRoutes, ...(await sitterRoutes())];
}

/**
 * One entry per sitter profile.
 *
 * No lastModified: profiles.updated_at is a dead column that nothing in the app
 * maintains, and last_active_at tracks the person rather than the page, so either
 * one would be a confidently wrong date. An omitted lastmod is a missing signal;
 * a wrong one is a misleading signal.
 *
 * A failure here yields no sitter entries rather than failing the build. The
 * sitemap is a hint to crawlers, and trading a whole deployment for it is a bad
 * exchange — the static routes above still ship.
 */
async function sitterRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_sitter", true);

    if (error || !data) return [];

    return data.map((sitter) => ({
      url: siteUrl(`/sitters/${sitter.id}`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    return [];
  }
}
