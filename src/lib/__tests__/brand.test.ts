import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PALETTE, SIGNATURES } from "@/lib/brand";
import en from "@/lib/i18n/en";
import lt from "@/lib/i18n/lt";

const CSS = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

describe("PALETTE", () => {
  it("is the colours the app actually paints with", () => {
    for (const { token, hex } of PALETTE) {
      const m = new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, "i").exec(CSS);
      expect(m?.[1]?.toLowerCase(), `--${token}`).toBe(hex);
    }
  });

  it("names every colour in both languages", () => {
    for (const { id } of PALETTE) {
      expect(en.brand.colour[id]).toBeTruthy();
      expect(lt.brand.colour[id]).toBeTruthy();
    }
  });
});

describe("SIGNATURES", () => {
  it("gives each of the three promises a fixed name and a line, in both languages", () => {
    expect(SIGNATURES).toEqual(["smartId", "live", "agreed"]);
    for (const id of SIGNATURES) {
      for (const dict of [en, lt]) {
        expect(dict.brand.signatures[id].name).toBeTruthy();
        expect(dict.brand.signatures[id].text).toBeTruthy();
      }
    }
  });
});
