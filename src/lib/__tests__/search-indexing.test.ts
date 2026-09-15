import { describe, it, expect, vi } from "vitest";
// @ts-expect-error Next ships its compiled path-to-regexp (the matcher headers() uses) without types.
import { pathToRegexp as untypedPathToRegexp } from "next/dist/compiled/path-to-regexp";

const pathToRegexp = untypedPathToRegexp as (source: string) => RegExp;

/**
 * Only the landing page belongs in search results (Lukas, 2026-09-15).
 *
 * robots.txt Disallow does not remove a page from Google: a blocked URL it already knows can
 * still be listed, and blocking the crawl also hides any noindex from it. So every path but "/"
 * answers with an X-Robots-Tag noindex header, robots.txt lets crawlers in to see it, and the
 * sitemap lists the landing page alone.
 */

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

async function robotsHeaderSources(): Promise<string[]> {
  const { default: nextConfig } = await import("../../../next.config");
  const rules = await nextConfig.headers!();
  return rules
    .filter((rule) => rule.headers.some((h) => h.key.toLowerCase() === "x-robots-tag" && /noindex/.test(h.value)))
    .map((rule) => rule.source);
}

const noindexed = async (path: string) =>
  (await robotsHeaderSources()).some((source) => pathToRegexp(source).test(path));

describe("X-Robots-Tag noindex", () => {
  it("is never sent for the landing page", async () => {
    expect(await noindexed("/")).toBe(false);
  });

  it.each([
    "/browse",
    "/browse/740b5962-4f41-4871-9c4e-333d7680325b",
    "/dashboard",
    "/profile",
    "/smart-id-demo",
    "/legal/terms",
    "/legal/privacy",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/sitters",
    "/sitters/740b5962-4f41-4871-9c4e-333d7680325b",
  ])("is sent for %s", async (path) => {
    expect(await noindexed(path)).toBe(true);
  });
});

describe("robots.txt", () => {
  it("blocks nothing, so crawlers can see the noindex, and points at the sitemap", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    for (const rule of rules) {
      expect(rule.disallow ?? []).toEqual([]);
      expect(rule.allow).toBe("/");
    }
    expect(result.sitemap).toBe("https://petbnb.lt/sitemap.xml");
  });
});

describe("sitemap", () => {
  it("lists the landing page and nothing else", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toEqual(["https://petbnb.lt/"]);
  });
});
