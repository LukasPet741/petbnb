/**
 * The PetBnB brand (mark from look A, 2026-10-10; colours Spruce & Moss, 2026-10-24) as data, for the /brand page.
 *
 * Every colour here is a token the app already paints with (globals.css); brand.test.ts
 * fails if the two drift apart. Names live in the dictionaries (brand.colour.<id>).
 */

export const PALETTE = [
  { id: "pine", token: "brand", hex: "#1b4d3a" },
  { id: "night", token: "ink", hex: "#0f1a14" },
  { id: "mist", token: "surface-2", hex: "#e4e9de" },
  { id: "linen", token: "linen", hex: "#f6f3ec" },
  { id: "amber", token: "amber", hex: "#c9923f" },
] as const;

/**
 * The three things only PetBnB does, always under the same name and icon:
 * a sitter whose identity Smart-ID confirmed, the collar's live location, and a
 * price owner and sitter agreed in the chat.
 */
export const SIGNATURES = ["smartId", "live", "agreed"] as const;

export type Signature = (typeof SIGNATURES)[number];
