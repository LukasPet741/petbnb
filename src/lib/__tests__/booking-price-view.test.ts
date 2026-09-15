import { describe, it, expect } from "vitest";
import { bookingPriceView } from "@/lib/booking-price-view";

/**
 * What a booking card says about price and which accept button it shows, from the booking and
 * its offers. `t` echoes the key and its price so the assertions read which copy was chosen.
 */

const t = (key: string, vars?: Record<string, string | number>) => (vars?.price ? `${key}:${vars.price}` : key);
/** Lithuanian money uses a non-breaking space before the euro sign. */
const plain = (text: string | null | undefined) => text?.split(String.fromCharCode(160)).join(" ");
const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
const booking = (over: Record<string, unknown> = {}) => ({
  owner_id: "o",
  sitter_id: "s",
  status: "pending",
  service: "boarding" as const,
  start_at: future,
  asking_price: 125,
  agreed_price: null,
  ...over,
});
const offer = (sender_id: string, amount: number, minute: number) => ({
  id: `m${minute}`,
  sender_id,
  amount,
  created_at: new Date(Date.UTC(2026, 8, 15, 12, minute)).toISOString(),
});

describe("bookingPriceView", () => {
  it("asks the sitter to accept the asking price when nobody has offered", () => {
    const view = bookingPriceView(booking(), [], "sitter", t, "en");
    expect(view.priceLine).toBe("common.pricing.asking:€125");
    expect(view.canAccept).toBe(true);
    expect(view.acceptAmount).toBe(125);
    expect(view.acceptLabel).toBe("appPages.bookings.acceptForButton:€125");
    expect(view.waitingLabel).toBeNull();
  });

  it("tells the owner they are waiting for the sitter", () => {
    const view = bookingPriceView(booking(), [], "owner", t, "en");
    expect(view.canAccept).toBe(false);
    expect(view.waitingLabel).toBe("appPages.bookings.waitingForSitter");
  });

  it("shows the newest offer and lets the owner accept the sitter's counter", () => {
    const view = bookingPriceView(booking(), [offer("o", 100, 1), offer("s", 115, 2)], "owner", t, "lt");
    expect(plain(view.priceLine)).toBe("common.pricing.offered:115 €");
    expect(plain(view.acceptLabel)).toBe("appPages.bookings.agreeForButton:115 €");
    expect(view.acceptAmount).toBe(115);
  });

  it("shows the agreed price once confirmed, with no accept", () => {
    const view = bookingPriceView(booking({ status: "signed", agreed_price: 115 }), [offer("s", 115, 2)], "owner", t, "en");
    expect(view.priceLine).toBe("common.pricing.agreed:€115");
    expect(view.canAccept).toBe(false);
    expect(view.waitingLabel).toBeNull();
  });

  it("says nothing about price for a declined or cancelled request", () => {
    expect(bookingPriceView(booking({ status: "declined" }), [], "owner", t, "en").priceLine).toBeNull();
  });
});
