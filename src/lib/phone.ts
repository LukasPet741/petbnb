/**
 * Phone numbers on /profile: Lithuania, Latvia or Estonia, stored as "+370 61234567"
 * (dial code, a space, the national digits).
 */

export type PhoneCountry = "LT" | "LV" | "EE";

export const PHONE_COUNTRIES: readonly PhoneCountry[] = ["LT", "LV", "EE"];

export const PHONE_DIAL: Record<PhoneCountry, string> = { LT: "+370", LV: "+371", EE: "+372" };

export const PHONE_FLAG: Record<PhoneCountry, string> = { LT: "🇱🇹", LV: "🇱🇻", EE: "🇪🇪" };

/** Shown as the placeholder and in the error: a mobile number the way people write it. */
export const PHONE_EXAMPLE: Record<PhoneCountry, string> = { LT: "612 34567", LV: "2123 4567", EE: "5123 4567" };

/** How many national digits each country has: LT and LV always 8; EE 7 or 8. */
const LENGTHS: Record<PhoneCountry, readonly number[]> = { LT: [8], LV: [8], EE: [7, 8] };

export interface Phone {
  country: PhoneCountry;
  national: string;
}

const fits = (country: PhoneCountry, digits: string) => LENGTHS[country].includes(digits.length);

function countryOfDial(code: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => PHONE_DIAL[c] === `+${code}`);
}

/**
 * Reads what the visitor typed, for the country picked. Spaces, dashes and brackets are
 * dropped; a pasted "+371 …", "00371 …" or "371 …" picks its own country; Lithuania's
 * domestic 8 (or the newer 0) in front is dropped. Null when it is not a number of that
 * country's length, or not a Baltic number at all.
 */
export function parsePhone(country: PhoneCountry, input: string): Phone | null {
  const compact = input.replace(/[\s\-().]/g, "");
  const international = compact.match(/^(?:\+|00)(\d+)$/);
  if (international) {
    const code = countryOfDial(international[1].slice(0, 3));
    const national = international[1].slice(3);
    return code && fits(code, national) ? { country: code, national } : null;
  }
  if (!/^\d+$/.test(compact)) return null;
  if (fits(country, compact)) return { country, national: compact };
  // "370 61234567" without the plus: the national number never starts that long with 37x.
  const bare = countryOfDial(compact.slice(0, 3));
  if (bare && fits(bare, compact.slice(3))) return { country: bare, national: compact.slice(3) };
  if (country === "LT" && /^[80]/.test(compact) && fits("LT", compact.slice(1))) {
    return { country, national: compact.slice(1) };
  }
  return null;
}

/** Splits a stored number into the picker's country and the rest; Lithuania when it has no dial code. */
export function splitPhone(stored: string | null | undefined): Phone {
  const value = (stored ?? "").trim();
  for (const country of PHONE_COUNTRIES) {
    if (value.startsWith(PHONE_DIAL[country])) {
      return { country, national: value.slice(PHONE_DIAL[country].length).trim() };
    }
  }
  return { country: "LT", national: value };
}

export function formatPhone({ country, national }: Phone): string {
  return `${PHONE_DIAL[country]} ${national}`;
}
