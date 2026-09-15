import type { ServiceType } from "@/lib/types";
import { offeredServices } from "@/lib/services";

// Curated, verified imagery for the marketing/auth surfaces.
// All URLs HEAD-checked to return 200. Real user/sitter/pet photos live in
// the database (profiles.avatar_url / pets.photo_url); this module only holds
// the static photography used on the landing and auth pages.

const U = "https://images.unsplash.com";
const p = (id: string, w: number, h: number) =>
  `${U}/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const HERO = {
  main: p("photo-1450778869180-41d0601e046e", 900, 1200), // dog, warm
  // The full-bleed hero backdrop. Deliberately the dog-walking frame rather than a
  // wide crop of `main`: `main` is a portrait close-up, and cropping it to 16:10
  // lands on abstract fur with no animal readable. Requested at 1600px because it
  // renders full-bleed — the pinboard this replaced upscaled a 128px avatar across
  // 460px, which is the exact failure to avoid.
  wide: p("photo-1548199973-03cce0bbc87b", 1600, 1000),
  topRight: p("photo-1535268647677-300dbf3d78d1", 500, 500), // kitten
  bottomLeft: p("photo-1548199973-03cce0bbc87b", 600, 420), // walking dogs
};

export const SECTION = {
  becomeSitter: p("photo-1518717758536-85ae29035b6d", 1000, 1000), // happy dog
  care: p("photo-1444212477490-ca407925329e", 900, 700), // puppy
};

export const AUTH = {
  login: p("photo-1543466835-00a7907e9de1", 1000, 1400), // dog portrait
  signup: p("photo-1583337130417-3346a1be7dee", 1000, 1400), // dog, cozy
};

/**
 * One photograph per service, for surfaces that show WHAT a sitter does rather than
 * WHO they are: the profile cover and the landing page's service cards.
 *
 * Sitters upload an avatar and nothing else, so a profile cover cannot be of them. A
 * picture of the service, captioned with its name, is honest where a stock "sitter"
 * would not be. Each was picked by looking at it, and all four return 200 (checked
 * 2026-09-14); the grooming frame is new, the other three were already on the site.
 */
export const SERVICE_PHOTO_ID: Record<ServiceType, string> = {
  walking: "photo-1548199973-03cce0bbc87b", // two dogs out on a path
  boarding: "photo-1494256997604-768d1f608cac", // a cat under a blanket at home
  daycare: "photo-1444212477490-ca407925329e", // three puppies together
  grooming: "photo-1719464454959-9cf304ef4774", // a poodle being trimmed
};

/**
 * Where the animal is, as a CSS object-position. The cover is a wide band (up to ~3.5:1)
 * cut from 3:2 photographs, and a centre crop took the walking dogs' ears off — found by
 * looking at it. Requesting the photo at its own aspect and positioning it in CSS keeps
 * one image good for every band shape.
 */
export const SERVICE_PHOTO_FOCUS: Record<ServiceType, string> = {
  walking: "50% 30%",
  boarding: "50% 50%",
  daycare: "50% 50%",
  grooming: "50% 35%",
};

/** The service's photograph at width `w`, at the photos' own 3:2 aspect. */
export function servicePhoto(service: ServiceType, w: number): string {
  return p(SERVICE_PHOTO_ID[service], w, Math.round((w * 2) / 3));
}

/**
 * More than one photograph per service, for places that show many sitters at once. Found in
 * the 2026-09-15 review of /browse: most sitters offer walking first, so one photo per service
 * put the same two dogs on seventeen cards. Each pool starts with SERVICE_PHOTO_ID, so the
 * landing tiles still match. Chosen from a contact sheet of 25 candidates, all 200 on
 * 2026-09-15, keeping calm natural frames that show the service and dropping studio
 * backdrops and a photo with a brand logo in it.
 */
export const SERVICE_PHOTO_POOL: Record<ServiceType, readonly string[]> = {
  walking: [
    SERVICE_PHOTO_ID.walking,
    "photo-1477884213360-7e9d7dcc1e48", // a spotted dog on a walk down a street
    "photo-1518717758536-85ae29035b6d", // a brown dog on a garden path
    "photo-1543466835-00a7907e9de1", // a beagle outdoors
  ],
  boarding: [
    SERVICE_PHOTO_ID.boarding,
    "photo-1495360010541-f48722b34f7d", // a tabby cat on the stairs at home
    "photo-1519052537078-e6302a4968d4", // a ginger cat asleep on a wooden floor
  ],
  daycare: [
    SERVICE_PHOTO_ID.daycare,
    "photo-1507146426996-ef05306b995a", // a puppy indoors by its water bowl
    "photo-1581888227599-779811939961", // a dog in its bed in a bright room
  ],
  grooming: [
    SERVICE_PHOTO_ID.grooming,
    "photo-1516734212186-a967f81ad0d7", // a retriever being brushed
  ],
};

/** FNV-1a: a cheap, stable string hash, so a sitter keeps the same photo across visits. */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The pool photo for one sitter and service, at width `w`, at the photos' own 3:2 aspect: `pick`
 * when a grid chose one from this service's pool (see spreadCoverPhotos), else the sitter's own hash.
 */
export function sitterCoverPhoto(sitterId: string, service: ServiceType, w: number, pick?: string): string {
  const pool = SERVICE_PHOTO_POOL[service];
  const photoId = pick && pool.includes(pick) ? pick : pool[stableHash(sitterId) % pool.length];
  return p(photoId, w, Math.round((w * 2) / 3));
}

/** How far back a card looks for photos to avoid: its left neighbour, and the card above it in a two- or three-column grid. */
const COVER_WINDOW = 3;

/**
 * The cover photo for each card of a grid, in display order. Found in the 2026-09-15 review of
 * /browse: pools of two to four photos still put the same ginger cat on two neighbouring cards,
 * and only the grid knows which cards end up side by side. Each sitter starts from their own
 * hashed pick and moves along their pool to the first photo not used in the last three cards;
 * when the pool is too small for that, the photo used longest ago. Sitters who offer nothing
 * get no entry.
 */
export function spreadCoverPhotos(
  sitters: { id: string; services: Partial<Record<string, unknown>> | null | undefined }[],
): Map<string, string> {
  const picks = new Map<string, string>();
  const lastUsed = new Map<string, number>();
  sitters.forEach((sitter, position) => {
    const service = coverService(sitter.services);
    if (!service) return;
    const pool = SERVICE_PHOTO_POOL[service];
    const start = stableHash(sitter.id) % pool.length;
    let pick = pool[start];
    let pickAge = -Infinity;
    for (let step = 0; step < pool.length; step++) {
      const photo = pool[(start + step) % pool.length];
      const used = lastUsed.get(photo);
      const age = used === undefined ? Infinity : position - used;
      if (age > pickAge) {
        pick = photo;
        pickAge = age;
      }
      if (age > COVER_WINDOW) break;
    }
    picks.set(sitter.id, pick);
    lastUsed.set(pick, position);
  });
  return picks;
}

// What the last grid showed, so opening a card (a client-side navigation) keeps its picture on
// the profile. Module state on purpose: a full page load starts empty and falls back to the hash.
const rememberedCovers = new Map<string, string>();

export function rememberCovers(picks: Map<string, string>): void {
  for (const [sitterId, photoId] of picks) rememberedCovers.set(sitterId, photoId);
}

/** The photo a profile shows: the one its card just showed, else the sitter's own hashed pick. */
export function coverPhotoFor(sitterId: string, service: ServiceType, w: number): string {
  return sitterCoverPhoto(sitterId, service, w, rememberedCovers.get(sitterId));
}

/** Where to aim the crop: the tuned focus for a service's own photo, a gentle upper-middle otherwise. */
export function coverFocus(src: string, service: ServiceType): string {
  return src.includes(SERVICE_PHOTO_ID[service]) ? SERVICE_PHOTO_FOCUS[service] : "50% 40%";
}

/** The service a sitter's cover illustrates: the first one they offer, or null. */
export function coverService(
  services: Partial<Record<string, unknown>> | null | undefined,
): ServiceType | null {
  return offeredServices(services)[0] ?? null;
}
