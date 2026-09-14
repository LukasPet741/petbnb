import type { Profile } from "@/lib/types";

/**
 * Why the sitter in /bookings/new?sitter=… cannot be booked by this user, or null.
 *
 * Pure and outside the page for the same reason as offeredServices: the rules are worth
 * testing without React or Supabase. Each answer matches an insert the database refuses
 * (enforce_booking_rules, enforce_sitter_verified), said before the user fills the form in
 * rather than after.
 *
 * Verification is NOT checked here, deliberately: is_verified is not a public column
 * (PUBLIC_PROFILE_COLUMNS), and making it one is part of the Smart-ID badge design, with
 * its privacy-policy change. Until then the database's refusal is the only word on it —
 * and every production sitter is verified.
 */
export type SitterBlocker = "sitterNotFound" | "ownProfile" | "notASitter";

export function sitterBlocker(
  /** undefined while the profile is loading; null when there is no such profile. */
  sitter: Pick<Profile, "id" | "is_sitter"> | null | undefined,
  userId: string | undefined,
): SitterBlocker | null {
  if (sitter === undefined) return null;
  if (sitter === null) return "sitterNotFound";
  if (userId && sitter.id === userId) return "ownProfile";
  if (sitter.is_sitter !== true) return "notASitter";
  return null;
}
