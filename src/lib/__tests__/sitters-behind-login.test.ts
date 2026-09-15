import { describe, it, expect, vi } from "vitest";

/**
 * Since 2026-09-15 finding sitters needs an account (Lukas). The public directory and
 * profiles at /sitters are gone; their URLs must still land somewhere — bookmarks, shared
 * links and search results point at them — and the sitemap must stop advertising them.
 */

vi.mock("@/lib/supabase", () => {
  const rows = { data: [{ id: "740b5962-4f41-4871-9c4e-333d7680325b" }], error: null };
  const chain = { select: () => chain, eq: () => Promise.resolve(rows) };
  return { supabase: { from: () => chain } };
});

describe("old public sitter URLs", () => {
  it("redirect into the signed-in directory, keeping the sitter id, and are not cached forever", async () => {
    const { default: nextConfig } = await import("../../../next.config");
    const redirects = await nextConfig.redirects!();

    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/sitters", destination: "/browse", permanent: false },
        { source: "/sitters/:id", destination: "/browse/:id", permanent: false },
      ]),
    );
  });
});

describe("sitemap", () => {
  it("lists no sitter pages, public or private", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => new URL(entry.url).pathname);

    expect(urls.filter((path) => path.startsWith("/sitters") || path.startsWith("/browse"))).toEqual([]);
    expect(urls).toContain("/");
  });
});
