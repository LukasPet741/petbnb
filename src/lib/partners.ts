import type { Locale } from "@/lib/i18n";
import type { PetType } from "@/lib/types";

/**
 * Partner businesses shown on /partners: groomers, dog hotels, day centres, training
 * schools. Entered by hand for now; a table and an admin editor come later.
 *
 * Add a partner only once they have agreed by email, and show only what they agreed to:
 * a logo needs their yes to the logo. Put the logo in public/partners/<slug>.png (or
 * .svg) and set `logo`; without one the card shows the name's first letter.
 */

export type PartnerCategory = "boarding" | "daycare" | "grooming" | "training" | "walking";

/** Copy the partner is described in, one string per language. */
export type Localized = Record<Locale, string>;

export interface PartnerPrice {
  from: number;
  to?: number;
  /** "per night", "per course"… */
  unit: Localized;
}

export interface PartnerService {
  name: Localized;
  price?: PartnerPrice;
  /** The service's own page on the partner's site, e.g. a course with its price. */
  url?: string;
}

export interface PartnerLocation {
  city: string;
  area?: string;
  address?: string;
  /** "Indoors and outdoors across the city"… */
  note?: Localized;
  /** Geocoded once, from OpenStreetMap (Nominatim), when the address is entered. */
  lat?: number;
  lng?: number;
  /** Only the area is known, so the map marks it as approximate (a dashed pin). */
  approximate?: boolean;
}

export interface Partner {
  slug: string;
  name: string;
  categories: PartnerCategory[];
  /** The animals they take; the map and the list filter on it. */
  accepts: PetType[];
  locations: PartnerLocation[];
  hours?: Localized;
  description: Localized;
  services: PartnerService[];
  /** Shown when the services carry no prices of their own. */
  pricesNote?: Localized;
  website?: string;
  /** Path under /public, e.g. "/partners/dogiday.png". */
  logo?: string;
  /** Joined before the launch. */
  founding?: boolean;
}

export const PARTNERS: Partner[] = [
  {
    // Agreed 26 Oct 2026 by email (logo and photos: yes). Description is our draft from
    // their answers; they confirm it when they see the page.
    slug: "dogiday",
    name: "Dogiday",
    categories: ["boarding", "daycare", "grooming"],
    accepts: ["dog"],
    // No street address yet (ask when sending the preview): the centre of Antakalnis.
    locations: [{ city: "Vilnius", area: "Antakalnis", lat: 54.7056, lng: 25.3145, approximate: true }],
    hours: { lt: "Kasdien 7:30–19:30", en: "Every day 7:30–19:30" },
    description: {
      lt: "Šunų viešbutis, dienos centras ir kirpykla Vilniaus Antakalnyje. Šunys čia apsistoja trumpam ar ilgesniam laikui, praleidžia dieną dienos centre arba užsuka nusikirpti. Dirba tik su šunimis.",
      en: "A dog hotel, day centre and grooming salon in Antakalnis, Vilnius. Dogs stay for a few days or longer, spend the day at the day centre, or come in for a groom. Dogs only.",
    },
    services: [
      { name: { lt: "Trumpalaikis apgyvendinimas", en: "Short-term boarding" } },
      { name: { lt: "Ilgalaikis apgyvendinimas", en: "Long-term boarding" } },
      { name: { lt: "Dienos centras", en: "Day centre" } },
      { name: { lt: "Šunų kirpimas", en: "Dog grooming" } },
    ],
    pricesNote: {
      lt: "Kainos priklauso nuo viešnagės trukmės, šuns dydžio ir švenčių laikotarpio.",
      en: "Prices depend on the length of the stay, the dog's size and holiday periods.",
    },
    website: "https://dogiday.lt",
    founding: true,
  },
  {
    // Agreed 26 Oct 2026 by email (logo: yes; photos not asked). Course list from their
    // email; each course's page on their site carries its price.
    slug: "dogpunk",
    name: "DogPunk",
    categories: ["training"],
    accepts: ["dog"],
    locations: [
      {
        city: "Vilnius",
        address: "Kalvarijų g. 143",
        lat: 54.7185,
        lng: 25.2902,
        note: { lt: "Salėje ir lauke visame mieste", en: "Indoors, and outdoors across the city" },
      },
      {
        city: "Panevėžys",
        address: "Ramygalos g. 94B",
        lat: 55.7183,
        lng: 24.3646,
        note: { lt: "Salėje ir lauke visame mieste", en: "Indoors, and outdoors across the city" },
      },
    ],
    description: {
      lt: "Šunų dresūros mokykla Vilniuje ir Panevėžyje. Individualios pamokos ir grupiniai kursai: nuo pirmųjų žingsnių iki pilno paklusnumo, elgesio mieste, triukų ir reabilitacijos bailiems bei jautriems šunims. Taip pat siūlo vebinarų įrašus apie šunų elgesį.",
      en: "A dog training school in Vilnius and Panevėžys. Individual lessons and group courses: from the first steps to full obedience, manners in the city, tricks, and rehabilitation for fearful and sensitive dogs. Also sells recorded webinars on dog behaviour.",
    },
    services: [
      { name: { lt: "Individualios pamokos", en: "Individual lessons" }, url: "https://mokyksuni.lt/klases/individuali-sunu-dresura/" },
      { name: { lt: "1 klasė – Pirmokai", en: "Class 1 – First-years" }, url: "https://mokyksuni.lt/klases/profesionali-sunu-dresura-vilniuje-kaip-aukleti-maza-suniuka/" },
      { name: { lt: "2 klasė – Studentai", en: "Class 2 – Students" }, url: "https://mokyksuni.lt/klases/sunu-mokykla-vilniuje-pazenge-pazengusiems/" },
      { name: { lt: "3 klasė – Profesoriai", en: "Class 3 – Professors" }, url: "https://mokyksuni.lt/klases/sunu-dresavimas-vilniuje-pazengusiems/" },
      { name: { lt: "Kursas „Paaugliai“", en: "Teens course" }, url: "https://mokyksuni.lt/klases/kursas-paaugliai/" },
      { name: { lt: "Pilno paklusnumo kursas", en: "Full obedience course" }, url: "https://mokyksuni.lt/klases/pilno-paklusnumo-kursas/" },
      { name: { lt: "Smagiai ir mandagiai mieste", en: "Fun and polite in the city" }, url: "https://mokyksuni.lt/klases/drasuros-kursai-sunims-mieste/" },
      { name: { lt: "Reabilitacija bailiems ir jautriems šunims", en: "Rehab for fearful and sensitive dogs" }, url: "https://mokyksuni.lt/klases/reabilitacijos-kursai-bailiems-ir-jautriems-sunims/" },
      { name: { lt: "„Šunų meditacija“", en: "Dog meditation" }, url: "https://mokyksuni.lt/klases/kursas-sunu-meditacija/" },
      { name: { lt: "Linksmas triukų kursas", en: "Fun tricks course" }, url: "https://mokyksuni.lt/klases/triuku-kursas/" },
    ],
    pricesNote: {
      lt: "Kiekvieno kurso kaina nurodyta jo puslapyje.",
      en: "Each course's price is on its own page.",
    },
    website: "https://mokyksuni.lt/",
    founding: true,
  },
];

/** A link to the partner's site, tagged so they can see the visits PetBnB sends them. */
export function trackedUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set("utm_source", "petbnb");
  url.searchParams.set("utm_medium", "partners");
  return url.toString();
}

export function partnerWebsite(partner: Partner): string | null {
  return partner.website ? trackedUrl(partner.website) : null;
}

/** "Vilnius, Antakalnis", or "Vilnius · Panevėžys" for a partner in several cities. */
export function partnerPlace(partner: Partner): string {
  if (partner.locations.length === 1) {
    const [only] = partner.locations;
    return only.area ? `${only.city}, ${only.area}` : only.city;
  }
  return [...new Set(partner.locations.map((l) => l.city))].join(" · ");
}

/** Partners that take at least one of these animals; no animals given = every partner. */
export function partnersFor(species: readonly PetType[], partners: Partner[] = PARTNERS): Partner[] {
  if (species.length === 0) return partners;
  return partners.filter((p) => p.accepts.some((a) => species.includes(a)));
}

export interface MapPlace {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  approximate: boolean;
}

/** One point per geocoded location: a partner in two cities is two points. */
export function mapPlaces(partners: Partner[]): MapPlace[] {
  return partners.flatMap((p) =>
    p.locations.flatMap((l) =>
      l.lat != null && l.lng != null
        ? [{ slug: p.slug, name: p.name, lat: l.lat, lng: l.lng, approximate: l.approximate ?? false }]
        : [],
    ),
  );
}

/** "€25–40 per night", or "from €25 per night" when there is no upper bound. */
export function formatPartnerPrice(price: PartnerPrice, locale: Locale, fromWord: string): string {
  const amount = price.to != null ? `€${price.from}–${price.to}` : `${fromWord} €${price.from}`;
  return `${amount} ${price.unit[locale]}`;
}
