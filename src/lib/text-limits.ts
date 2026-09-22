/**
 * Caps on the free-text fields that have no length limit of their own.
 *
 * `reviews.body` (2000) and an offer note (280) are already held by CHECK constraints and
 * live next to them in reviews.ts and pricing.ts. These four had nothing anywhere: a
 * scripted client could put a megabyte in `about_me` and every /browse response would
 * carry it, and the same for a pet bio or a chat line.
 *
 * `maxLength` on the input is the honest half of the fix — it stops a person pasting a
 * novel, not a script posting one. The matching CHECK constraints are section 7 of
 * docs/security/2026-09-20-hardening.sql, which needs Lukas's yes before it runs; until
 * then these are UX only. Keep the two sides equal when either changes.
 */
export const FULL_NAME_MAX = 80;
export const CITY_MAX = 80;
export const ABOUT_ME_MAX = 1200;
export const PET_NAME_MAX = 40;
export const PET_BIO_MAX = 600;
export const MESSAGE_BODY_MAX = 2000;
