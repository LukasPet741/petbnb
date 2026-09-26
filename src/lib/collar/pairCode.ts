/**
 * The pairing code printed on a collar's sticker: 8 Crockford base-32 characters, shown as
 * XXXX-XXXX. claim_collar cleans codes the same way (public.clean_pair_code), so the browser and
 * the database agree on what "the same code" means.
 */
export const PAIR_CODE_LENGTH = 8;

const VALID = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export function cleanPairCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^0-9A-Z]/g, "");
}

export function isPairCode(clean: string): boolean {
  return VALID.test(clean);
}

export function formatPairCode(clean: string): string {
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}
