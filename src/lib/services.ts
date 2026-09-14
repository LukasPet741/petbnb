import { SERVICE_LABELS, type ServiceType } from "@/lib/types";

/**
 * Which services a sitter offers, and which one a booking form should hold.
 *
 * Both pure, and deliberately outside the page: the booking form used to render all
 * four services straight from SERVICE_LABELS and default to "walking" whoever the
 * sitter was. Every production sitter offers between one and three services, so that
 * default was wrong for anyone who does not walk dogs, and a booking for a service
 * the sitter does not provide was two taps away.
 *
 * Since migration 20260914193216 the database refuses a service the sitter does not offer
 * (enforce_booking_rules reads the same map, strictly `true`), so an option offered here
 * that the sitter cannot fulfil would end in the generic submit error.
 */

const SERVICE_KEYS = Object.keys(SERVICE_LABELS) as ServiceType[];

/**
 * The services marked true on a profile, in SERVICE_KEYS order.
 *
 * Deliberately defensive: the map arrives as JSON from Postgres, so its key order is
 * whatever was written, it may carry keys that are not services, and it may be null
 * for a profile that never filled the form in. Iterating SERVICE_KEYS rather than the
 * object's own keys fixes the order and drops anything unknown in one step.
 *
 * Values must be exactly `true`. Truthiness would count the string "false" -- which a
 * malformed row could easily hold -- as an offered service, and failing closed here
 * costs a sitter one profile edit while failing open costs an owner a declined booking.
 */
export function offeredServices(
  services: Partial<Record<string, unknown>> | null | undefined,
): ServiceType[] {
  if (!services || typeof services !== "object") return [];
  return SERVICE_KEYS.filter((key) => services[key] === true);
}

/**
 * The service the form should hold, given what this sitter offers and what was
 * already picked. One function for all three rules, because they are the same
 * question asked at three moments: first render, sitter change, and re-render.
 *
 * - A still-offered choice survives.
 * - Exactly one service offered preselects it: 8 of 25 production sitters, for whom
 *   tapping the single option is pointless ceremony.
 * - Anything else clears. An empty choice is the point rather than a shortcoming --
 *   silently defaulting is what sent "walking" to sitters who do not walk dogs, and
 *   it must not survive a sitter change either.
 */
export function resolveService(
  offered: readonly ServiceType[],
  current: ServiceType | "",
): ServiceType | "" {
  if (current && offered.includes(current)) return current;
  if (offered.length === 1) return offered[0];
  return "";
}
