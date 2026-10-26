import type { Locale } from "@/lib/i18n";

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
}

export interface Partner {
  slug: string;
  name: string;
  categories: PartnerCategory[];
  city: string;
  area?: string;
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
    city: "Vilnius",
    area: "Antakalnis",
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
];

/** The partner's site, tagged so they can see the visits PetBnB sends them. */
export function partnerWebsite(partner: Partner): string | null {
  if (!partner.website) return null;
  const url = new URL(partner.website);
  url.searchParams.set("utm_source", "petbnb");
  url.searchParams.set("utm_medium", "partners");
  return url.toString();
}

/** "€25–40 per night", or "from €25 per night" when there is no upper bound. */
export function formatPartnerPrice(price: PartnerPrice, locale: Locale, fromWord: string): string {
  const amount = price.to != null ? `€${price.from}–${price.to}` : `${fromWord} €${price.from}`;
  return `${amount} ${price.unit[locale]}`;
}
