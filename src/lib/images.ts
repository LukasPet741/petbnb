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

/** The service a sitter's cover illustrates: the first one they offer, or null. */
export function coverService(
  services: Partial<Record<string, unknown>> | null | undefined,
): ServiceType | null {
  return offeredServices(services)[0] ?? null;
}
