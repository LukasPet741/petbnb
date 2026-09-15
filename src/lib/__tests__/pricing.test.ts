import { describe, it, expect } from "vitest";
import {
  MAX_OFFERS_PER_SIDE,
  PERIOD_DAYS,
  askingPrice,
  canAccept,
  cheapestDailyRate,
  dailyRate,
  draftsFromPrices,
  pricesFromDrafts,
  negotiation,
  offerBounds,
  comparablePrice,
  priceSummary,
  stayDays,
  validPrices,
  type OfferLike,
  type SitterPrices,
} from "@/lib/pricing";

/**
 * The price rules, as the UI mirrors them. The database is the authority
 * (migration sitter_pricing_and_offers); these exist so a button only appears when the
 * database would accept what it sends. Every rule here has a twin in that migration.
 */

const PRICES: SitterPrices = {
  walking: { amount: 10, days: 1 },
  boarding: { amount: 75, days: 3 },
  daycare: { amount: 90, days: 7 },
  grooming: { amount: 35 },
};

describe("stayDays", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 8, 21, 9) + h * 3_600_000).toISOString();

  it("counts every started 24 hours as a day", () => {
    expect(stayDays(at(0), at(8))).toBe(1); // Mon 09:00 → Mon 17:00
    expect(stayDays(at(0), at(24))).toBe(1); // Mon 09:00 → Tue 09:00
    expect(stayDays(at(0), at(25))).toBe(2); // Mon 09:00 → Tue 10:00
    expect(stayDays(at(0), at(57))).toBe(3); // Mon 09:00 → Wed 18:00
  });

  it("is null for an empty, unparseable, reversed or zero-length range", () => {
    expect(stayDays("", at(1))).toBeNull();
    expect(stayDays("nonsense", at(1))).toBeNull();
    expect(stayDays(at(5), at(1))).toBeNull();
    expect(stayDays(at(1), at(1))).toBeNull();
  });
});

describe("askingPrice", () => {
  it("charges the full period price for a stay no longer than the period", () => {
    expect(askingPrice(PRICES, "boarding", 1)).toBe(75);
    expect(askingPrice(PRICES, "boarding", 3)).toBe(75);
    expect(askingPrice(PRICES, "daycare", 2)).toBe(90);
  });

  it("stretches the price for a longer stay, rounded to whole euros", () => {
    expect(askingPrice(PRICES, "boarding", 5)).toBe(125);
    expect(askingPrice(PRICES, "boarding", 4)).toBe(100);
    expect(askingPrice(PRICES, "daycare", 10)).toBe(129); // 90 × 10 / 7 = 128.57
    expect(askingPrice(PRICES, "walking", 6)).toBe(60);
  });

  it("rounds halves up, as Postgres round() does for positive numbers", () => {
    expect(askingPrice({ boarding: { amount: 25, days: 10 } }, "boarding", 13)).toBe(33); // 32.5
  });

  it("is always the visit price for grooming, however long the booking", () => {
    expect(askingPrice(PRICES, "grooming", 1)).toBe(35);
    expect(askingPrice(PRICES, "grooming", 4)).toBe(35);
  });

  it("is null for a service without a price", () => {
    expect(askingPrice({}, "walking", 2)).toBeNull();
    expect(askingPrice(null, "walking", 2)).toBeNull();
  });
});

describe("dailyRate and cheapestDailyRate", () => {
  const sitter = (services: Record<string, boolean>, prices: SitterPrices) => ({ services, prices });

  it("divides the period price by its days", () => {
    expect(dailyRate({ amount: 75, days: 3 })).toBe(25);
  });

  it("takes the cheapest daily rate among offered, priced services, never grooming", () => {
    const s = sitter({ walking: true, boarding: true, daycare: false, grooming: true }, PRICES);
    expect(cheapestDailyRate(s)).toBe(10);
    const noWalk = sitter({ walking: false, boarding: true, daycare: true, grooming: true }, PRICES);
    expect(cheapestDailyRate(noWalk)).toBeCloseTo(90 / 7);
  });

  it("uses the filtered service's rate when a service is chosen", () => {
    const s = sitter({ walking: true, boarding: true, daycare: false, grooming: false }, PRICES);
    expect(cheapestDailyRate(s, "boarding")).toBe(25);
    expect(cheapestDailyRate(s, "daycare")).toBeNull(); // not offered
    expect(cheapestDailyRate(s, "grooming")).toBeNull(); // no daily rate
  });

  it("is null for a sitter with no priced period service", () => {
    expect(cheapestDailyRate(sitter({ grooming: true }, { grooming: { amount: 35 } }))).toBeNull();
    expect(cheapestDailyRate(sitter({ walking: true }, {}))).toBeNull();
  });
});

describe("validPrices", () => {
  it("accepts the shapes the database accepts", () => {
    expect(validPrices(PRICES)).toBe(true);
    expect(validPrices({})).toBe(true);
  });

  it.each([
    ["an unknown service", { cleaning: { amount: 5, days: 1 } }],
    ["a period not on the list", { walking: { amount: 10, days: 2 } }],
    ["a fractional amount", { walking: { amount: 10.5, days: 1 } }],
    ["a zero amount", { walking: { amount: 0, days: 1 } }],
    ["an amount above the cap", { walking: { amount: 10_001, days: 1 } }],
    ["grooming with a period", { grooming: { amount: 35, days: 1 } }],
    ["a period service without days", { boarding: { amount: 75 } }],
    ["an array", []],
    ["null", null],
  ])("rejects %s", (_, value) => {
    expect(validPrices(value)).toBe(false);
  });

  it("offers exactly the periods Lukas listed, plus two weeks and a month", () => {
    expect([...PERIOD_DAYS]).toEqual([1, 3, 7, 10, 14, 30]);
  });
});

describe("negotiation", () => {
  const OWNER = "owner-1";
  const SITTER = "sitter-1";
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
  const booking = (over: Partial<Parameters<typeof negotiation>[0]> = {}) => ({
    owner_id: OWNER,
    sitter_id: SITTER,
    status: "pending",
    service: "boarding" as const,
    start_at: future,
    asking_price: 125,
    ...over,
  });
  let seq = 0;
  const offer = (by: string, amount: number): OfferLike => {
    seq += 1;
    return { id: `o-${String(seq).padStart(3, "0")}`, sender_id: by, amount, created_at: new Date(Date.UTC(2026, 8, 15, 12, seq)).toISOString() };
  };

  it("puts the asking price on the table when nobody has offered", () => {
    const n = negotiation(booking(), []);
    expect(n.onTable).toEqual({ amount: 125, by: "asking" });
    expect(n.offersLeft).toEqual({ owner: MAX_OFFERS_PER_SIDE, sitter: MAX_OFFERS_PER_SIDE });
    expect(canAccept(n, "sitter")).toBe(true);
    expect(canAccept(n, "owner")).toBe(false);
  });

  it("puts the newest offer on the table, whatever order the rows arrive in", () => {
    const a = offer(OWNER, 100);
    const b = offer(SITTER, 115);
    const n = negotiation(booking(), [b, a]);
    expect(n.onTable).toEqual({ amount: 115, by: "sitter" });
    expect(n.latest).toEqual({ owner: 100, sitter: 115 });
    expect(n.offersLeft).toEqual({ owner: 2, sitter: 2 });
    expect(canAccept(n, "owner")).toBe(true);
    expect(canAccept(n, "sitter")).toBe(false);
  });

  it("lets the sitter accept the owner's offer and not their own counter", () => {
    const n = negotiation(booking(), [offer(SITTER, 118), offer(OWNER, 105)]);
    expect(n.onTable).toEqual({ amount: 105, by: "owner" });
    expect(canAccept(n, "sitter")).toBe(true);
    expect(canAccept(n, "owner")).toBe(false);
  });

  it("closes once the booking is no longer pending or has started", () => {
    expect(canAccept(negotiation(booking({ status: "signed" }), []), "sitter")).toBe(false);
    const started = negotiation(booking({ start_at: new Date(Date.now() - 3_600_000).toISOString() }), []);
    expect(canAccept(started, "sitter")).toBe(false);
    expect(offerBounds(started, "owner")).toBeNull();
  });

  describe("offerBounds", () => {
    it("keeps an owner's offer between half the asking price and just under it", () => {
      expect(offerBounds(negotiation(booking(), []), "owner")).toEqual({ min: 63, max: 124 });
    });

    it("keeps an owner's offer below the sitter's most recent counter", () => {
      const n = negotiation(booking(), [offer(OWNER, 90), offer(SITTER, 110)]);
      expect(offerBounds(n, "owner")).toEqual({ min: 63, max: 109 });
    });

    it("keeps a sitter's counter above the owner's most recent offer and under the asking price", () => {
      const n = negotiation(booking(), [offer(OWNER, 90)]);
      expect(offerBounds(n, "sitter")).toEqual({ min: 91, max: 124 });
      expect(offerBounds(negotiation(booking(), []), "sitter")).toEqual({ min: 1, max: 124 });
    });

    it("stops a side after three offers", () => {
      const n = negotiation(booking(), [offer(OWNER, 70), offer(OWNER, 75), offer(OWNER, 80)]);
      expect(n.offersLeft.owner).toBe(0);
      expect(offerBounds(n, "owner")).toBeNull();
      expect(offerBounds(n, "sitter")).toEqual({ min: 81, max: 124 });
    });

    it("is null when no amount fits", () => {
      const tight = negotiation(booking(), [offer(OWNER, 124)]);
      expect(offerBounds(tight, "sitter")).toBeNull();
      expect(offerBounds(negotiation(booking({ asking_price: 1 }), []), "owner")).toBeNull();
    });

    it("never allows offers on grooming or without an asking price", () => {
      expect(offerBounds(negotiation(booking({ service: "grooming", asking_price: 35 }), []), "owner")).toBeNull();
      expect(offerBounds(negotiation(booking({ asking_price: null }), []), "owner")).toBeNull();
      expect(canAccept(negotiation(booking({ service: "grooming", asking_price: 35 }), []), "sitter")).toBe(true);
    });
  });
});

describe("priceSummary", () => {
  const sitter = (services: Record<string, boolean>, prices: SitterPrices) => ({ services, prices });

  it("leads with the cheapest daily rate, rounded to whole euros", () => {
    expect(priceSummary(sitter({ daycare: true, boarding: true }, PRICES))).toEqual({ kind: "daily", amount: 13 }); // 90 / 7
  });

  it("shows the visit price for a groomer, or when grooming is the chosen service", () => {
    expect(priceSummary(sitter({ grooming: true }, PRICES))).toEqual({ kind: "visit", amount: 35 });
    expect(priceSummary(sitter({ walking: true, grooming: true }, PRICES), "grooming")).toEqual({ kind: "visit", amount: 35 });
  });

  it("follows the chosen period service", () => {
    expect(priceSummary(sitter({ walking: true, boarding: true }, PRICES), "boarding")).toEqual({ kind: "daily", amount: 25 });
  });

  it("is null when nothing offered has a price", () => {
    expect(priceSummary(sitter({ walking: true }, {}))).toBeNull();
    expect(priceSummary(sitter({ walking: true }, PRICES), "daycare")).toBeNull();
  });

  it("gives a comparable number for sorting and caps: the daily rate, or the visit price for grooming", () => {
    expect(comparablePrice(sitter({ boarding: true }, PRICES))).toBe(25);
    expect(comparablePrice(sitter({ grooming: true }, PRICES), "grooming")).toBe(35);
    expect(comparablePrice(sitter({ grooming: true }, PRICES))).toBeNull();
  });
});

describe("profile form drafts", () => {
  it("starts from the saved prices, with sensible periods for anything unpriced", () => {
    const drafts = draftsFromPrices({ boarding: { amount: 75, days: 3 }, grooming: { amount: 35 } });
    expect(drafts.boarding).toEqual({ amount: "75", days: 3 });
    expect(drafts.grooming).toEqual({ amount: "35", days: 1 });
    expect(drafts.walking).toEqual({ amount: "", days: 1 });
    expect(drafts.daycare).toEqual({ amount: "", days: 1 });
  });

  it("turns drafts back into prices and names every offered service without a valid price", () => {
    const drafts = {
      walking: { amount: "12", days: 1 as const },
      boarding: { amount: "", days: 3 as const },
      daycare: { amount: "0", days: 7 as const },
      grooming: { amount: "36", days: 1 as const },
    };
    const { prices, missing } = pricesFromDrafts(drafts, { walking: true, boarding: true, daycare: true, grooming: true });
    expect(prices).toEqual({ walking: { amount: 12, days: 1 }, grooming: { amount: 36 } });
    expect(missing).toEqual(["boarding", "daycare"]);
    expect(validPrices(prices)).toBe(true);
  });

  it("keeps a valid price for a service switched off, so switching it back on does not lose it", () => {
    const drafts = draftsFromPrices({ boarding: { amount: 75, days: 3 } });
    const { prices, missing } = pricesFromDrafts(drafts, { walking: false, boarding: false, daycare: false, grooming: false });
    expect(prices).toEqual({ boarding: { amount: 75, days: 3 } });
    expect(missing).toEqual([]);
  });

  it("rejects fractions and amounts above the cap", () => {
    const drafts = { ...draftsFromPrices({}), walking: { amount: "12.5", days: 1 as const }, daycare: { amount: "10001", days: 1 as const } };
    expect(pricesFromDrafts(drafts, { walking: true, daycare: true, boarding: false, grooming: false }).missing).toEqual(["walking", "daycare"]);
  });
});
