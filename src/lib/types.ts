export type ServiceType = "walking" | "boarding" | "daycare" | "grooming";
export type PetType = "dog" | "cat" | "bird" | "reptile" | "small_mammal" | "fish" | "other";
export type BookingStatus = "pending" | "signed" | "declined" | "cancelled" | "completed";

export interface Profile {
  id: string;
  full_name: string;
  /**
   * Optional because the public queries no longer ask for it. Every page a
   * signed-out visitor can reach selects PUBLIC_PROFILE_COLUMNS, which omits the
   * phone number; only a signed-in user reading their own profile has one. Nothing
   * outside /profile reads this field.
   */
  phone?: string | null;
  city: string;
  is_sitter: boolean;
  rate_per_hour: number | null;
  experience_years: number | null;
  services: Record<ServiceType, boolean>;
  about_me: string | null;
  avatar_url: string | null;
  last_active_at: string;
}

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  type: PetType;
  sex: "male" | "female" | "unknown";
  weight_kg: number | null;
  bio: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  owner_id: string;
  sitter_id: string;
  pet_id: string;
  service: ServiceType;
  start_at: string;
  end_at: string;
  address: string | null;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  owner?: Profile;
  sitter?: Profile;
  pet?: Pet;
}

/** Which way a review points. Matches the reviews.direction CHECK constraint. */
export type ReviewDirection = "owner_to_sitter" | "sitter_to_owner";

/** Every optional dimension column on reviews. */
export type ReviewDimension =
  | "communication"
  | "pet_wellbeing"
  | "reliability"
  | "pet_as_described"
  | "handover";

/**
 * Which dimensions each direction may carry.
 *
 * The database enforces this too, in reviews_dimensions_match_direction. Offering a
 * dimension the constraint rejects would produce a 23514 the user can do nothing
 * about, so the two definitions have to agree — pinned by review-dimensions.test.ts.
 */
export const REVIEW_DIMENSIONS: Record<ReviewDirection, readonly ReviewDimension[]> = {
  owner_to_sitter: ["pet_wellbeing", "communication", "reliability"],
  sitter_to_owner: ["communication", "pet_as_described", "handover"],
};

export function dimensionsFor(direction: ReviewDirection): readonly ReviewDimension[] {
  return REVIEW_DIMENSIONS[direction];
}

/**
 * All five dimension columns set to null.
 *
 * A write spreads its own answers over this. Sending every column explicitly matters on
 * an UPDATE: omitting one would leave a value from a previous edit in place, and if
 * that value belonged to the other direction the CHECK would reject the whole row.
 */
export function emptyDimensions(
  _direction: ReviewDirection,
): Record<ReviewDimension, number | null> {
  return {
    communication: null,
    pet_wellbeing: null,
    reliability: null,
    pet_as_described: null,
    handover: null,
  };
}

export interface Review {
  id: string;
  booking_id: string;
  /** Who wrote it. */
  author_id: string;
  /** Who it is about. */
  subject_id: string;
  direction: ReviewDirection;
  /** The overall star. The only rating that is ever required. */
  rating: number;
  body: string | null;
  created_at: string;
  communication: number | null;
  pet_wellbeing: number | null;
  reliability: number | null;
  pet_as_described: number | null;
  handover: number | null;
  /** Embedded author profile, for review lists. */
  author?: Pick<Profile, "id" | "full_name" | "avatar_url">;
}

/** A sitter's aggregate rating, as read from the public.sitter_ratings view. */
export interface SitterRating {
  /** Null when the sitter has no usable rating — never 0. See averageRating(). */
  average: number | null;
  count: number;
}

/**
 * The profile columns anyone is allowed to receive for *somebody else's* profile.
 *
 * Signed in or out makes no difference here. The name is historical: this started as
 * the signed-out list, because the public pages used to `select("*")` and shipped
 * every column of all 43 rows to any browser that loaded the sitter directory. The
 * signed-in pages did exactly the same thing for another six weeks — browse,
 * dashboard, saved, the booking form and the right rail each handed every sitter's
 * phone number to every logged-in visitor. They now select this list too.
 *
 * Kept in one place because nine separate queries feed it, and a tenth will
 * eventually be added by someone who copies one of them. Postgres backs it up: both
 * anon and authenticated hold column grants rather than a table grant, so a
 * `select("*")` against profiles is a hard error rather than a quiet leak.
 *
 * Your OWN profile is not this — it comes from the `my_profile` view, which is the
 * one place phone is readable. See useProfile.
 */
export const PUBLIC_PROFILE_COLUMNS =
  "id, full_name, city, about_me, avatar_url, experience_years, rate_per_hour, services, last_active_at, is_sitter";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  walking: "Dog Walking",
  boarding: "Boarding",
  daycare: "Daycare",
  grooming: "Grooming",
};

export const PET_TYPE_LABELS: Record<PetType, string> = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  reptile: "Reptile",
  small_mammal: "Small Mammal",
  fish: "Fish",
  other: "Other",
};

export const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-soft text-amber-strong ring-1 ring-inset ring-amber/20" },
  signed: { label: "Confirmed", color: "bg-brand-soft text-brand-strong ring-1 ring-inset ring-brand/15" },
  declined: { label: "Declined", color: "bg-danger-soft text-danger ring-1 ring-inset ring-danger/20" },
  cancelled: { label: "Cancelled", color: "bg-surface-2 text-ink-soft ring-1 ring-inset ring-black/10" },
  completed: { label: "Completed", color: "bg-brand-softer text-brand ring-1 ring-inset ring-brand/10" },
};

export type MessageKind = "user" | "system";
export type SystemEvent = "requested" | "accepted" | "declined" | "cancelled" | "completed";

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  kind: MessageKind;
  /** Set only when kind === "user". */
  body: string | null;
  /** Set only when kind === "system". The UI translates this; no display text is stored. */
  event: SystemEvent | null;
  read_at: string | null;
  created_at: string;
  sender?: Profile;
}

export type NotificationType =
  | "booking_requested"
  | "booking_accepted"
  | "booking_declined"
  | "booking_cancelled"
  | "booking_completed"
  | "message_received";

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  booking_id: string | null;
  type: NotificationType;
  read_at: string | null;
  created_at: string;
  email_status: "pending" | "sent" | "skipped" | "failed";
  email_error: string | null;
  actor?: Profile;
  booking?: Booking;
}

/** One row in the /messages thread list. Threads are 1:1 with bookings. */
export interface Thread {
  booking: Booking;
  counterparty: Profile | null;
  lastMessage: Message | null;
  unreadCount: number;
}
