import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INTL_LOCALES = { en: "en-GB", lt: "lt-LT" } as const;

export function formatDate(date: string | Date, locale: keyof typeof INTL_LOCALES = "en") {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatCurrency(amount: number, locale: keyof typeof INTL_LOCALES = "en") {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Relative timestamp. Lifted out of CollarsPanel, where it was one of three
 * near-identical private copies. `keyPrefix` lets each surface keep its own
 * translation keys: pass "appPages.collars" for the collar panel, or rely on
 * the shared "common.timeAgo" defaults.
 */
export function timeAgo(
  iso: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  keyPrefix = "common.timeAgo"
): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return t(`${keyPrefix}.justNow`);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t(`${keyPrefix}.minutesAgo`, { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t(`${keyPrefix}.hoursAgo`, { hours });
  return t(`${keyPrefix}.daysAgo`, { days: Math.floor(hours / 24) });
}

/** Clock time for message bubbles, e.g. "14:05". */
export function formatTime(date: string | Date, locale: keyof typeof INTL_LOCALES = "en") {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Normalises a free-text city name to one canonical spelling.
 *
 * The profile form takes city as plain text, so the database stores whatever was
 * typed. Production ended up with "kaunas" beside "Kaunas", and "Mažeikiai " with a
 * trailing space beside what should have been the same place — three rows for two
 * cities. Both the city filter and the landing page's city list group on the exact
 * string, so each variant became its own city, and the sitter profile renders the raw
 * value, so one page read "kaunas".
 *
 * Trims, collapses internal runs of whitespace, and title-cases each word so
 * two-word names like "Naujoji Akmenė" survive. Case mapping goes through the
 * Lithuanian locale rather than the default: it is the locale whose rules apply to
 * these strings, and relying on the ambient one is how this sort of thing rots.
 *
 * Returns null for a blank entry — the column is nullable, and an empty string would
 * group and sort as a city named nothing.
 */
export function normaliseCity(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (collapsed.length === 0) return null;

  return collapsed
    .split(" ")
    .map((word) => word.slice(0, 1).toLocaleUpperCase("lt") + word.slice(1).toLocaleLowerCase("lt"))
    .join(" ");
}
