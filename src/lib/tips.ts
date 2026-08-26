// Pet-care tips for the logged-in app. Images reuse the already-HEAD-verified
// Unsplash photos from lib/images.ts (all return 200), so nothing 404s.
const U = "https://images.unsplash.com";
const img = (id: string) => `${U}/${id}?auto=format&fit=crop&w=500&h=300&q=80`;

export interface Tip {
  tag: string;
  title: string;
  body: string;
  image: string;
}

export const TIPS: Tip[] = [
  { tag: "Walking", title: "Beat the midday heat", body: "On warm days, walk early or late. If the pavement is too hot for your hand, it's too hot for paws.", image: img("photo-1548199973-03cce0bbc87b") },
  { tag: "Boarding", title: "Pack the familiar", body: "Send your pet's own bed, a favourite toy and their usual food so a boarding stay feels like home.", image: img("photo-1518717758536-85ae29035b6d") },
  { tag: "Grooming", title: "Brush between sessions", body: "A few minutes of brushing a week prevents mats — and keeps the shedding off your sofa.", image: img("photo-1583337130417-3346a1be7dee") },
  { tag: "Settling in", title: "Give a shy pet space", body: "Let nervous animals approach on their own terms. A quiet corner and a calm voice go a long way.", image: img("photo-1543466835-00a7907e9de1") },
  { tag: "Health", title: "Fresh water, always", body: "Top up bowls often, especially in summer. Good hydration keeps pets happy and healthy.", image: img("photo-1561037404-61cd46aa615b") },
  { tag: "Cats", title: "Cats love routine", body: "Keep feeding times and litter spots consistent. For a cat, predictability is comfort.", image: img("photo-1494256997604-768d1f608cac") },
  { tag: "Play", title: "Tire the body and mind", body: "A bored pet invents its own fun. Mix walks with puzzle toys and short training games.", image: img("photo-1444212477490-ca407925329e") },
  { tag: "Safety", title: "Always an ID tag", body: "A collar tag plus an up-to-date microchip are the fastest way home if a pet slips out.", image: img("photo-1601758228041-f3b2795255f1") },
  { tag: "First time", title: "Start with a meet & greet", body: "Booking a new sitter? A short hello first lets your pet and sitter get comfortable.", image: img("photo-1517849845537-4d257902454a") },
  { tag: "Diet", title: "Keep meals consistent", body: "Sudden food changes upset stomachs. Send a sitter your pet's usual food and portions.", image: img("photo-1450778869180-41d0601e046e") },
];

export function tipOfTheDay(): Tip {
  const day = Math.floor(Date.now() / 86_400_000);
  return TIPS[day % TIPS.length];
}
