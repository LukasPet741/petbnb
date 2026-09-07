import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The glass system, pinned.
 *
 * Before this existed, seven surfaces carried frosted glass through five different
 * ad-hoc recipes — two base colours (canvas/surface), three alphas (/80, /85, /90),
 * two blur radii and two border tokens. Nothing connected them, so every new surface
 * picked a sixth recipe and the drift compounded.
 *
 * These tests make the shared token the only way to get glass. They are source-level
 * on purpose: the built CSS is not available when `npm test` runs in CI (the workflow
 * runs test before build), so a bundle-reading test would fail there. Verifying that
 * the utility actually SHIPS is a separate manual step against the built chunk — this
 * project has been bitten by Tailwind silently dropping classes it cannot parse.
 */

const SRC = join(process.cwd(), "src");
const CSS = join(SRC, "app", "globals.css");

/** Every .tsx file under src, recursively. */
function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const FILES = tsxFiles(SRC);
const css = readFileSync(CSS, "utf8");

/** file:line for every line matching a pattern, across all components. */
function hits(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (pattern.test(line)) {
          found.push(`${file.replace(SRC, "src").replace(/\\/g, "/")}:${i + 1}`);
        }
      });
  }
  return found.sort();
}

describe("the glass token is defined once", () => {
  it("declares the glass custom properties in :root", () => {
    for (const token of ["--glass-tint", "--glass-blur", "--glass-border"]) {
      expect(css, `${token} missing from globals.css`).toContain(token);
    }
  });

  it("exposes glass as a Tailwind utility rather than a class soup", () => {
    // @utility is the Tailwind v4 way. tailwind.config.ts is dead in this project
    // (no @config directive), so a JS-config utility would silently never exist.
    expect(css).toMatch(/@utility\s+glass\s*\{/);
  });

  it("degrades where backdrop-filter is unsupported", () => {
    // Without this, bg-canvas/80 alone leaves the header washed out and semi-legible
    // on any engine without backdrop-filter.
    expect(css).toMatch(/@supports[^{]*backdrop-filter/);
  });

  it("honours prefers-reduced-transparency", () => {
    expect(css).toContain("prefers-reduced-transparency");
  });

  it("never hand-writes the -webkit- prefix", () => {
    // Verified against the built bundle: when both the standard and the -webkit-
    // property are declared, Lightning CSS collapses them and keeps ONLY the
    // prefixed form — which leaves Firefox (unprefixed-only) with a tint and no
    // blur, and the @supports fallback does not catch it because that condition
    // still evaluates true there. Declare the standard property alone and let
    // Lightning CSS add prefixes.
    // Only as a DECLARATION. Naming it inside the @supports condition above is
    // correct and required — that is a feature query, not a property.
    const declared = css
      .split(/\r?\n/)
      .filter((line) => /^\s*-webkit-backdrop-filter\s*:/.test(line));
    expect(declared).toEqual([]);
  });
});

describe("no surface hand-rolls its own glass", () => {
  it("has no raw backdrop-blur utility left in any component", () => {
    // The whole point: a raw backdrop-blur-* in a component means a sixth recipe was
    // invented. Glass comes from the token or it does not happen.
    expect(hits(/\bbackdrop-blur-/)).toEqual([]);
  });

  it("has no raw backdrop-filter arbitrary value either", () => {
    expect(hits(/\[backdrop-filter:/)).toEqual([]);
  });

  it("still applies glass somewhere, so an empty codebase cannot pass", () => {
    // Guards against the lazy fix of deleting every glass surface to make the
    // assertions above go green.
    expect(hits(/\bglass\b/).length).toBeGreaterThan(6);
  });
});
