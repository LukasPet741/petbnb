/**
 * The legal documents and the sections each one renders, in display order.
 *
 * These arrays are the single source of truth for three things that must agree:
 * the routes under src/app/legal, the order sections appear on the page, and the
 * i18n keys under `legal.*` in both languages. src/lib/i18n/__tests__/legal.test.ts
 * pins that agreement — the headings carry their own ordinal, so reordering an
 * array here without renumbering the copy is a test failure, not a silent typo.
 */

export const LEGAL_DOCS = ["terms", "privacy"] as const;

export type LegalDoc = (typeof LEGAL_DOCS)[number];

export const TERMS_SECTIONS = [
  "aboutProject",
  "acceptance",
  "userAccounts",
  "bookings",
  "payments",
  "sitters",
  "conduct",
  "liability",
  "dataAndPrivacy",
  "changes",
] as const;

export const PRIVACY_SECTIONS = [
  "whoWeAre",
  "whatWeCollect",
  "howWeUse",
  "email",
  "whereItLives",
  "browserStorage",
  "whoCanSee",
  "noTracking",
  "yourRights",
] as const;

/** The sections belonging to a document, for callers that hold only its name. */
export const SECTIONS_BY_DOC: Record<LegalDoc, readonly string[]> = {
  terms: TERMS_SECTIONS,
  privacy: PRIVACY_SECTIONS,
};
