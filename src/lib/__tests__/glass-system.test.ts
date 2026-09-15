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

/** The body of the first block whose header matches, found by counting braces. */
function block(source: string, header: RegExp): string {
  const match = header.exec(source);
  if (!match) return "";
  const open = source.indexOf("{", match.index);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  return "";
}

/** Files, not lines, that match — for "exactly these files do X" assertions. Tests are
 *  left out: rendering a component in a test is not mounting it in the app. */
function filesMatching(pattern: RegExp): string[] {
  return [...new Set(hits(pattern).map((hit) => hit.replace(/:\d+$/, "")))].filter(
    (file) => !file.includes("/__tests__/"),
  );
}

const MATERIALS = [...css.matchAll(/@utility\s+(glass[\w-]*)\s*\{/g)].map((m) => m[1]);

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

describe("every material degrades on its own", () => {
  // A material missing from a fallback block is not caught by anything else: on an engine
  // without backdrop-filter, or for a user who asked for less transparency, it silently
  // stays a see-through tint with text on it.
  it("finds every material, so the loops below cannot pass empty", () => {
    expect(MATERIALS).toEqual(
      expect.arrayContaining(["glass", "glass-panel", "glass-card", "glass-chip", "glass-scrim"]),
    );
  });

  it.each(MATERIALS)("%s goes opaque where backdrop-filter is unsupported", (name) => {
    expect(block(css, /@supports\s+not\b/)).toMatch(new RegExp(`\\.${name}\\s*\\{`));
  });

  it.each(MATERIALS)("%s goes opaque under prefers-reduced-transparency", (name) => {
    expect(block(css, /@media\s*\(prefers-reduced-transparency/)).toMatch(
      new RegExp(`\\.${name}\\s*\\{`),
    );
  });
});

describe("one ambient field, beneath every page", () => {
  it("is mounted by the root layout and nowhere else", () => {
    expect(filesMatching(/<Atmosphere\b/)).toEqual(["src/app/layout.tsx"]);
  });

  it("paints beneath the page content, not over it", () => {
    // position: fixed always creates a stacking context. With z-index auto that context
    // is painted in the positioned layer, ABOVE every non-positioned section — seen in
    // Chrome on the landing page, where the old layer hit-tested above the content and
    // tinted it like a veil. z-index -1 puts the whole layer between the canvas and the page.
    const rule = block(css, /(^|\n)\.atmosphere\s*\{/);
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/z-index:\s*-1\b/);
    expect(rule).toMatch(/pointer-events:\s*none/);
  });

  it("stays pale enough for --ink-soft text set straight on it (4.5:1)", () => {
    // Recomputes the field from the .atmosphere rule and the --aurora-* tokens: each
    // radial-gradient runs from its colour at the centre to transparent at the stop,
    // listed top layer first, composited over --canvas. Sampled across desktop, laptop,
    // phone and landscape-phone viewports, because the ellipses are sized in percent.
    // Measured in the browser 2026-09-15: a pine bloom at 0.24 looked right and put
    // section subtitles at 3.97:1.
    const hex = (name: string) => {
      const value = new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, "i").exec(css)?.[1];
      if (!value) throw new Error(`--${name} not found`);
      return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
    };
    const token = (name: string) => {
      const m = new RegExp(`--aurora-${name}:\\s*rgb\\((\\d+) (\\d+) (\\d+) \\/ ([\\d.]+)\\)`).exec(css);
      if (!m) throw new Error(`--aurora-${name} not found`);
      return { rgb: [+m[1], +m[2], +m[3]], alpha: +m[4] };
    };
    const layers = [
      ...block(css, /(^|\n)\.atmosphere\s*\{/).matchAll(
        /radial-gradient\((\d+)% (\d+)% at (-?\d+)% (-?\d+)%, var\(--aurora-(\w+)\), transparent (\d+)%\)/g,
      ),
    ].map((m) => ({ rx: +m[1], ry: +m[2], cx: +m[3], cy: +m[4], ...token(m[5]), stop: +m[6] / 100 }));
    expect(layers.length).toBeGreaterThan(0);

    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]: number[]) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const inkSoft = luminance(hex("ink-soft"));
    const canvas = hex("canvas");

    let worst = Infinity;
    for (const [w, h] of [[1920, 889], [1280, 800], [390, 844], [844, 390]]) {
      for (let x = 0; x <= w; x += w / 80) {
        for (let y = 0; y <= h; y += h / 80) {
          let px = canvas;
          for (const l of [...layers].reverse()) {
            const t = Math.hypot((x - (l.cx / 100) * w) / ((l.rx / 100) * w), (y - (l.cy / 100) * h) / ((l.ry / 100) * h));
            const a = t < l.stop ? l.alpha * (1 - t / l.stop) : 0;
            px = px.map((c, i) => c * (1 - a) + l.rgb[i] * a);
          }
          worst = Math.min(worst, (luminance(px) + 0.05) / (inkSoft + 0.05));
        }
      }
    }
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });

  it("is not duplicated by a page or layout painting its own blobs", () => {
    // (app)/layout and /bookings/new each used to stack three blur-3xl circles on top of
    // the root layer, so signed-in pages carried two fields and the booking form three.
    expect(hits(/\bblur-3xl\b/)).toEqual([]);
  });

  it("is not covered by an opaque canvas fill anywhere", () => {
    // --canvas is the ground the field is painted on. An opaque bg-canvas above it — a page
    // wrapper, a band, a card — is a flat hole in the field. Translucent washes
    // (bg-canvas/25 on the hero photograph) are fine, hence the lookahead.
    expect(hits(/\bbg-canvas(?!\/)\b/)).toEqual([]);
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
