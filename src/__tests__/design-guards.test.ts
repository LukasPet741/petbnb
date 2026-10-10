import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Keeps the app unified (docs/design/unification-plan.md §4).
 *
 * A ratchet: each CEILING is how much of the old drift was left when the guard went in
 * (2026-10-10). New code may not add to it, and whoever removes some lowers the number
 * here in the same change, so the drift only ever shrinks. The hard rules are zero.
 * App code only: tests and the never-committed dev sandboxes are not counted.
 */

const SRC = path.join(process.cwd(), "src");

function appFiles(dir = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ["__tests__", "dev"].includes(e.name) ? [] : appFiles(p);
    return /\.tsx$/.test(e.name) ? [p] : [];
  });
}

const sources = appFiles().map((file) => ({ file: path.relative(SRC, file).replaceAll("\\", "/"), text: fs.readFileSync(file, "utf8") }));

function count(re: RegExp) {
  const hits = sources.map(({ file, text }) => ({ file, n: (text.match(re) ?? []).length })).filter((h) => h.n);
  return { total: hits.reduce((sum, h) => sum + h.n, 0), where: hits.map((h) => `${h.file} (${h.n})`).join(", ") };
}

// Lower these as the drift is removed; never raise them.
const CEILINGS: Record<string, { re: RegExp; max: number; use: string }> = {
  "raw hex colour": { re: /#[0-9a-fA-F]{6}\b/g, max: 58, use: "a colour token (globals.css)" },
  "text-[Npx] size": { re: /\btext-\[[0-9.]+px\]/g, max: 103, use: "the type scale (text-xs … text-4xl)" },
  "rounded-[Npx] radius": { re: /\brounded-\[[0-9.]+px\]/g, max: 15, use: "--radius-control / --radius-card / --radius-hero / rounded-full" },
  "bg-white/NN surface": { re: /\bbg-white\/\d+/g, max: 13, use: "bg-surface, glass-card or glass" },
  "animate-spin spinner": { re: /\banimate-spin\b/g, max: 15, use: "MoonLoader or a Skeleton" },
};

describe("design guards — the drift only shrinks", () => {
  for (const [name, { re, max, use }] of Object.entries(CEILINGS)) {
    it(`adds no new ${name}`, () => {
      const { total, where } = count(re);
      expect(total, `${name}: ${total} > ${max}. Use ${use}. Found in: ${where}`).toBeLessThanOrEqual(max);
    });
  }
});

describe("design guards — never", () => {
  it("asks with window.confirm (use useConfirm from components/ui/Confirm)", () => {
    expect(count(/\bwindow\.confirm\(|!\s*confirm\(\s*t\(/g).total).toBe(0);
  });

  it("paints in rose, which is not a brand colour (saved is amber)", () => {
    expect(count(/\b(?:bg|text|fill|border|ring)-rose-\d+/g).total).toBe(0);
  });

  it("brings back SuccessToast (use useToast from components/ui/Toast)", () => {
    expect(count(/SuccessToast/g).total).toBe(0);
  });
});
