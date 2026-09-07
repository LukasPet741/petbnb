import { describe, it, expect } from "vitest";
import { dictionaries } from "@/lib/i18n";
import { LEGAL_DOCS, TERMS_SECTIONS, PRIVACY_SECTIONS } from "@/lib/legal";

/**
 * LegalDoc renders t(`legal.${doc}.sections.${id}.heading`) and .body, building
 * every one of those keys by concatenation from the arrays in src/lib/legal.ts.
 * No type checks that, and t() returns the key itself when a lookup misses, so a
 * missing entry paints a raw dot-path like "legal.privacy.sections.email.body"
 * onto a page whose whole job is to be trustworthy.
 *
 * parity.test.ts guarantees EN and LT agree with each other. It cannot know
 * which keys the legal pages actually ask for. That is this file.
 */

type Dict = Record<string, unknown>;

/** The value at a dot-path, or undefined — the lookup t() performs. */
function resolve(dict: Dict, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Dict)) {
      return (node as Dict)[part];
    }
    return undefined;
  }, dict);
}

const LANGUAGES = ["en", "lt"] as const;

/** Every key the pages request that does not resolve to a string, per language. */
function unresolved(keys: string[]): string[] {
  const bad: string[] = [];
  for (const lang of LANGUAGES) {
    for (const key of keys) {
      if (typeof resolve(dictionaries[lang] as Dict, key) !== "string") {
        bad.push(`${lang}:${key}`);
      }
    }
  }
  return bad;
}

const SECTIONS = {
  terms: TERMS_SECTIONS,
  privacy: PRIVACY_SECTIONS,
} as const;

describe("legal document sections", () => {
  it("lists both documents in the order the nav renders them", () => {
    expect(LEGAL_DOCS).toEqual(["terms", "privacy"]);
  });

  it.each(LEGAL_DOCS)("resolves a heading and a body for every %s section", (doc) => {
    const keys = SECTIONS[doc].flatMap((id) => [
      `legal.${doc}.sections.${id}.heading`,
      `legal.${doc}.sections.${id}.body`,
    ]);
    expect(unresolved(keys)).toEqual([]);
  });

  it.each(LEGAL_DOCS)("resolves the page chrome for %s", (doc) => {
    expect(
      unresolved([
        `legal.${doc}.title`,
        `legal.${doc}.lastUpdated`,
        `legal.${doc}.intro`,
        `legal.${doc}.contactPrefix`,
        `legal.${doc}.contactCta`,
      ]),
    ).toEqual([]);
  });

  it("resolves the shared layout chrome", () => {
    expect(
      unresolved(["legal.backLink", "legal.nav.terms", "legal.nav.privacy"]),
    ).toEqual([]);
  });

  it("has a non-trivial number of sections, so an emptied array cannot pass silently", () => {
    // Every it.each above is vacuously green against an empty array.
    expect(TERMS_SECTIONS.length).toBeGreaterThan(5);
    expect(PRIVACY_SECTIONS.length).toBeGreaterThan(5);
  });

  it("numbers every heading consecutively from 1, in both languages", () => {
    // The headings carry their own ordinal ("1. About this project"), inherited
    // from the page this replaces. Adding or reordering a section without
    // renumbering is otherwise invisible until a human reads the built page.
    const misnumbered: string[] = [];
    for (const lang of LANGUAGES) {
      for (const doc of LEGAL_DOCS) {
        SECTIONS[doc].forEach((id, index) => {
          const heading = resolve(
            dictionaries[lang] as Dict,
            `legal.${doc}.sections.${id}.heading`,
          );
          if (typeof heading !== "string") return; // already reported above
          if (!heading.startsWith(`${index + 1}. `)) {
            misnumbered.push(`${lang}:${doc}.${id} -> ${heading}`);
          }
        });
      }
    }
    expect(misnumbered).toEqual([]);
  });
});
