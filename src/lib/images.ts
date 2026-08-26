// Curated, verified imagery for the marketing/auth surfaces.
// All URLs HEAD-checked to return 200. Real user/sitter/pet photos live in
// the database (profiles.avatar_url / pets.photo_url); this module only holds
// the static photography used on the landing and auth pages.

const U = "https://images.unsplash.com";
const p = (id: string, w: number, h: number) =>
  `${U}/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const HERO = {
  main: p("photo-1450778869180-41d0601e046e", 900, 1200), // dog, warm
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
