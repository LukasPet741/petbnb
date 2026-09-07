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
