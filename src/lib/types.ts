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
  pending: { label: "Pending", color: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/70" },
  signed: { label: "Confirmed", color: "bg-brand-soft text-brand-strong ring-1 ring-inset ring-brand/15" },
  declined: { label: "Declined", color: "bg-red-50 text-red-600 ring-1 ring-inset ring-red-200/70" },
  cancelled: { label: "Cancelled", color: "bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200" },
  completed: { label: "Completed", color: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200/70" },
};
