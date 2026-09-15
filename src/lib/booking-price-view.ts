import { canAccept, negotiation, type NegotiationBooking, type OfferLike, type Role } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface BookingPriceView {
  /** "Prašoma 125 €" / "Siūloma 100 €" / "Sutarta 115 €", or null when price no longer matters. */
  priceLine: string | null;
  canAccept: boolean;
  /** The amount an accept sends, which the database checks against what is on the table. */
  acceptAmount: number | null;
  acceptLabel: string | undefined;
  waitingLabel: string | null;
}

/** What a booking card says about price, for one viewer. Mirrors the database's accept rules. */
export function bookingPriceView(
  booking: NegotiationBooking & { agreed_price?: number | null },
  offers: OfferLike[],
  role: Role,
  t: Translate,
  locale: "en" | "lt",
): BookingPriceView {
  const money = (amount: number) => formatCurrency(amount, locale);

  if (booking.agreed_price != null && (booking.status === "signed" || booking.status === "completed")) {
    return { priceLine: t("common.pricing.agreed", { price: money(booking.agreed_price) }), canAccept: false, acceptAmount: null, acceptLabel: undefined, waitingLabel: null };
  }

  if (booking.status !== "pending") {
    return { priceLine: null, canAccept: false, acceptAmount: null, acceptLabel: undefined, waitingLabel: null };
  }

  const n = negotiation(booking, offers);
  const table = n.onTable;
  const priceLine = table
    ? t(table.by === "asking" ? "common.pricing.asking" : "common.pricing.offered", { price: money(table.amount) })
    : null;
  const accept = canAccept(n, role);

  return {
    priceLine,
    canAccept: accept,
    acceptAmount: accept && table ? table.amount : null,
    acceptLabel: accept && table
      ? t(role === "sitter" ? "appPages.bookings.acceptForButton" : "appPages.bookings.agreeForButton", { price: money(table.amount) })
      : undefined,
    waitingLabel: !accept && n.open ? t(role === "sitter" ? "appPages.bookings.waitingForOwner" : "appPages.bookings.waitingForSitter") : null,
  };
}
