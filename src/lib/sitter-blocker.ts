import type { Profile } from "@/lib/types";

/**
 * Why the sitter in /bookings/new?sitter=… cannot be booked by this user, or null.
 *
 * Pure and outside the page for the same reason as offeredServices: the rules are worth
 * testing without React or Supabase. Each answer matches an insert the database refuses
 * (enforce_booking_rules, enforce_sitter_verified), said before the user fills the form in
 * rather than after.
 *
 * Verification is read from verification_method, public since the Smart-ID demo badge
 * (migration 20260915170921): 'none' is exactly the sitter whose is_verified is false. A
 * profile fetched without the column (undefined) is left to the database to refuse.
 */
export type SitterBlocker = "sitterNotFound" | "ownProfile" | "notASitter" | "notVerified";

export function sitterBlocker(
  /** undefined while the profile is loading; null when there is no such profile. */
  sitter: (Pick<Profile, "id" | "is_sitter"> & Partial<Pick<Profile, "verification_method">>) | null | undefined,
  userId: string | undefined,
): SitterBlocker | null {
  if (sitter === undefined) return null;
  if (sitter === null) return "sitterNotFound";
  if (userId && sitter.id === userId) return "ownProfile";
  if (sitter.is_sitter !== true) return "notASitter";
  if (sitter.verification_method === "none") return "notVerified";
  return null;
}
