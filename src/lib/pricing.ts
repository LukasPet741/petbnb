import type { ServiceType } from "@/lib/types";
import { offeredServices } from "@/lib/services";

/**
 * What a stay costs and how owner and sitter settle it (2026-09-15, spec
 * docs/superpowers/specs/2026-09-15-sitter-pricing-and-offers-design.md).
 *
 * The database is the authority: triggers in migration sitter_pricing_and_offers refuse
 * anything these rules refuse. The UI asks the same questions here first, so a button only
 * appears when the database would accept what it sends. Change a rule in both places.
 */

/** The periods a sitter can price: 1 day, 3 days, 1 week, 10 days, 2 weeks, 1 month. */
export const PERIOD_DAYS = [1, 3, 7, 10, 14, 30] as const;
export type PeriodDays = (typeof PERIOD_DAYS)[number];

export const MAX_PRICE = 10_000;
export const MAX_OFFERS_PER_SIDE = 3;
export const OFFER_NOTE_MAX = 280;

/** Every service but grooming is priced per period; grooming has one visit price. */
export type PeriodService = Exclude<ServiceType, "grooming">;
export const PERIOD_SERVICES: PeriodService[] = ["walking", "boarding", "daycare"];

export interface PeriodPrice { amount: number; days: PeriodDays }
export interface VisitPrice { amount: number }
export interface SitterPrices {
  walking?: PeriodPrice;
  boarding?: PeriodPrice;
  daycare?: PeriodPrice;
  grooming?: VisitPrice;
}

const DAY_MS = 86_400_000;

const isAmount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_PRICE;
const isPeriod = (v: unknown): v is PeriodDays => (PERIOD_DAYS as readonly unknown[]).includes(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Whether a value has exactly the shape the database's valid_prices() accepts. */
export function validPrices(value: unknown): value is SitterPrices {
  if (!isObject(value)) return false;
  return Object.entries(value).every(([key, entry]) => {
    if (!isObject(entry)) return false;
    const keys = Object.keys(entry).sort().join(",");
    if (key === "grooming") return keys === "amount" && isAmount(entry.amount);
    if (!(PERIOD_SERVICES as string[]).includes(key)) return false;
    return keys === "amount,days" && isAmount(entry.amount) && isPeriod(entry.days);
  });
}

/** Every started 24 hours is a day, minimum 1. Null when the range cannot be priced. */
export function stayDays(start: string | Date, end: string | Date): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

/** A valid period price for a service, or null. Tolerates a malformed row. */
function periodPrice(prices: SitterPrices | null | undefined, service: PeriodService): PeriodPrice | null {
  const entry = prices?.[service];
  return entry && isAmount(entry.amount) && isPeriod(entry.days) ? entry : null;
}

/** The grooming visit price, or null. */
export function visitPrice(prices: SitterPrices | null | undefined): number | null {
  const amount = prices?.grooming?.amount;
  return isAmount(amount) ? amount : null;
}

/**
 * What the sitter's price list asks for this stay: the visit price for grooming; otherwise the
 * period price as a minimum, stretched for longer stays and rounded half up to whole euros.
 * Integer arithmetic, so it rounds exactly as Postgres round(numeric) does.
 */
export function askingPrice(prices: SitterPrices | null | undefined, service: ServiceType, days: number): number | null {
  if (service === "grooming") return visitPrice(prices);
  const price = periodPrice(prices, service);
  if (!price || !Number.isInteger(days) || days < 1) return null;
  if (days <= price.days) return price.amount;
  return Math.floor((2 * price.amount * days + price.days) / (2 * price.days));
}

export function dailyRate(price: PeriodPrice): number {
  return price.amount / price.days;
}

/**
 * The per-day figure a card leads with: the chosen service's, or the cheapest among the
 * services the sitter offers and has priced. Grooming has no daily rate.
 */
export function cheapestDailyRate(
  sitter: { services: Partial<Record<string, unknown>> | null | undefined; prices?: SitterPrices | null },
  service?: ServiceType | "",
): number | null {
  const offered = offeredServices(sitter.services).filter((s): s is PeriodService => s !== "grooming");
  const candidates = service ? offered.filter((s) => s === service) : offered;
  const rates = candidates
    .map((s) => periodPrice(sitter.prices, s))
    .filter((p): p is PeriodPrice => p !== null)
    .map(dailyRate);
  return rates.length ? Math.min(...rates) : null;
}

/**
 * What a card leads with: the daily rate ("nuo 25 € / d.", rounded to whole euros), or the
 * visit price for a groomer or when grooming is the chosen service. Null when nothing fits.
 */
export function priceSummary(
  sitter: { services: Partial<Record<string, unknown>> | null | undefined; prices?: SitterPrices | null },
  service?: ServiceType | "",
): { kind: "daily" | "visit"; amount: number } | null {
  const groomingOffered = offeredServices(sitter.services).includes("grooming");
  if (service === "grooming") {
    const visit = groomingOffered ? visitPrice(sitter.prices) : null;
    return visit === null ? null : { kind: "visit", amount: visit };
  }
  const daily = cheapestDailyRate(sitter, service);
  if (daily !== null) return { kind: "daily", amount: Math.round(daily) };
  if (!service && groomingOffered) {
    const visit = visitPrice(sitter.prices);
    if (visit !== null) return { kind: "visit", amount: visit };
  }
  return null;
}

/**
 * The number /browse sorts and caps by: the daily rate, or the visit price when grooming is the
 * chosen service. Null when there is nothing comparable, which sorts last and passes any cap.
 */
export function comparablePrice(
  sitter: { services: Partial<Record<string, unknown>> | null | undefined; prices?: SitterPrices | null },
  service?: ServiceType | "",
): number | null {
  if (service === "grooming") return offeredServices(sitter.services).includes("grooming") ? visitPrice(sitter.prices) : null;
  return cheapestDailyRate(sitter, service);
}

// ---------------------------------------------------------------------------------------------
// The sitter's profile form
// ---------------------------------------------------------------------------------------------

/** One service's price as the form holds it: the amount as typed, and the chosen period. */
export interface PriceDraft { amount: string; days: PeriodDays }
export type PriceDrafts = Record<ServiceType, PriceDraft>;

/** Boarding is usually priced for a few nights; everything else starts at one day. */
const DEFAULT_PERIOD: Record<ServiceType, PeriodDays> = { walking: 1, boarding: 3, daycare: 1, grooming: 1 };

export function draftsFromPrices(prices: SitterPrices | null | undefined): PriceDrafts {
  const draft = (service: ServiceType): PriceDraft => {
    if (service === "grooming") {
      const visit = visitPrice(prices);
      return { amount: visit === null ? "" : String(visit), days: 1 };
    }
    const price = periodPrice(prices, service);
    return price ? { amount: String(price.amount), days: price.days } : { amount: "", days: DEFAULT_PERIOD[service] };
  };
  return { walking: draft("walking"), boarding: draft("boarding"), daycare: draft("daycare"), grooming: draft("grooming") };
}

/**
 * The prices to save, and every offered service still without a valid price. A valid price for a
 * service that is switched off is kept, so switching it back on does not lose it.
 */
export function pricesFromDrafts(
  drafts: PriceDrafts,
  offered: Partial<Record<ServiceType, boolean>>,
): { prices: SitterPrices; missing: ServiceType[] } {
  const prices: SitterPrices = {};
  const missing: ServiceType[] = [];
  const amountOf = (text: string) => (/^\d{1,5}$/.test(text.trim()) ? Number(text.trim()) : null);

  for (const service of ["walking", "boarding", "daycare", "grooming"] as ServiceType[]) {
    const amount = amountOf(drafts[service].amount);
    const valid = amount !== null && isAmount(amount);
    if (valid && service === "grooming") prices.grooming = { amount };
    else if (valid && service !== "grooming") prices[service] = { amount, days: drafts[service].days };
    if (!valid && offered[service]) missing.push(service);
  }
  return { prices, missing };
}

// ---------------------------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------------------------

export type Role = "owner" | "sitter";

export interface OfferLike {
  id: string;
  sender_id: string;
  amount: number;
  created_at: string;
}

export interface NegotiationBooking {
  owner_id: string;
  sitter_id: string;
  status: string;
  service: ServiceType;
  start_at: string;
  asking_price: number | null;
}

export interface Negotiation {
  asking: number | null;
  /** The newest offer, or the asking price when nobody has offered. */
  onTable: { amount: number; by: "asking" | Role } | null;
  /** Each side's most recent offer. */
  latest: Record<Role, number | null>;
  offersLeft: Record<Role, number>;
  /** Pending and not yet started (15 minutes' slack, as the database allows). */
  open: boolean;
  offersAllowed: boolean;
}

const SLACK_MS = 15 * 60_000;

/** Newest first, ties broken by id: the order the database reads "the newest offer" in. */
export function newestFirst<T extends OfferLike>(offers: T[]): T[] {
  return [...offers].sort((a, b) => {
    const t = Date.parse(b.created_at) - Date.parse(a.created_at);
    return t !== 0 ? t : b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });
}

export function negotiation(booking: NegotiationBooking, offers: OfferLike[], now = Date.now()): Negotiation {
  const sorted = newestFirst(offers);
  const roleOf = (o: OfferLike): Role | null =>
    o.sender_id === booking.owner_id ? "owner" : o.sender_id === booking.sitter_id ? "sitter" : null;
  const count = (role: Role) => sorted.filter((o) => roleOf(o) === role).length;
  const latestOf = (role: Role) => sorted.find((o) => roleOf(o) === role)?.amount ?? null;

  const newest = sorted[0];
  const newestRole = newest ? roleOf(newest) : null;
  const onTable = newest && newestRole
    ? { amount: newest.amount, by: newestRole }
    : booking.asking_price !== null
      ? { amount: booking.asking_price, by: "asking" as const }
      : null;

  const open = booking.status === "pending" && Date.parse(booking.start_at) > now - SLACK_MS;

  return {
    asking: booking.asking_price,
    onTable,
    latest: { owner: latestOf("owner"), sitter: latestOf("sitter") },
    offersLeft: {
      owner: Math.max(0, MAX_OFFERS_PER_SIDE - count("owner")),
      sitter: Math.max(0, MAX_OFFERS_PER_SIDE - count("sitter")),
    },
    open,
    offersAllowed: open && booking.service !== "grooming" && booking.asking_price !== null,
  };
}

/** The sitter accepts the asking price or the owner's offer; the owner accepts the sitter's counter. */
export function canAccept(n: Negotiation, role: Role): boolean {
  if (!n.open || !n.onTable) return false;
  return role === "owner" ? n.onTable.by === "sitter" : n.onTable.by !== "sitter";
}

/** The amounts a side may offer now, or null when it may not offer at all. */
export function offerBounds(n: Negotiation, role: Role): { min: number; max: number } | null {
  if (!n.offersAllowed || n.asking === null || n.offersLeft[role] === 0) return null;
  let min: number;
  let max = n.asking - 1;
  if (role === "owner") {
    min = Math.ceil(n.asking / 2);
    if (n.latest.sitter !== null) max = Math.min(max, n.latest.sitter - 1);
  } else {
    min = n.latest.owner !== null ? n.latest.owner + 1 : 1;
  }
  return min <= max ? { min, max } : null;
}
