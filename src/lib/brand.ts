/**
 * The PetBnB brand (look A, Calm, chosen 2026-10-10) as data, for the /brand page.
 *
 * Every colour here is a token the app already paints with (globals.css); brand.test.ts
 * fails if the two drift apart. Names live in the dictionaries (brand.colour.<id>).
 */

export const PALETTE = [
  { id: "pine", token: "brand", hex: "#1f5c47" },
  { id: "night", token: "ink", hex: "#131a17" },
  { id: "mist", token: "surface-2", hex: "#e9ede8" },
  { id: "linen", token: "linen", hex: "#f6f3ec" },
  { id: "amber", token: "amber", hex: "#dc9a35" },
] as const;

/**
 * The three things only PetBnB does, always under the same name and icon:
 * a sitter whose identity Smart-ID confirmed, the collar's live location, and a
 * price owner and sitter agreed in the chat.
 */
export const SIGNATURES = ["smartId", "live", "agreed"] as const;

export type Signature = (typeof SIGNATURES)[number];
