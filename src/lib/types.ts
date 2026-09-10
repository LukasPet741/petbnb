export type ServiceType = "walking" | "boarding" | "daycare" | "grooming";
export type PetType = "dog" | "cat" | "bird" | "reptile" | "small_mammal" | "fish" | "other";
export type BookingStatus = "pending" | "signed" | "declined" | "cancelled" | "completed";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
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

export interface Review {
  id: string;
  booking_id: string;
  owner_id: string;
  sitter_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  /** Embedded author profile. Reviews are public, and so is profiles.SELECT. */
  owner?: Pick<Profile, "id" | "full_name" | "avatar_url">;
}

/** A sitter's aggregate rating, as read from the public.sitter_ratings view. */
export interface SitterRating {
  /** Null when the sitter has no usable rating — never 0. See averageRating(). */
  average: number | null;
  count: number;
}

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
