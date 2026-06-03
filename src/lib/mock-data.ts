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
  rating?: number;
  review_count?: number;
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

export const CURRENT_USER: Profile = {
  id: "user-1",
  full_name: "Alex Morgan",
  phone: "+44 7911 123456",
  city: "London",
  is_sitter: false,
  rate_per_hour: null,
  experience_years: null,
  services: { walking: false, boarding: false, daycare: false, grooming: false },
  about_me: null,
  avatar_url: null,
  last_active_at: new Date().toISOString(),
};

export const MOCK_SITTERS: Profile[] = [
  {
    id: "sitter-1",
    full_name: "Sarah Chen",
    phone: "+44 7900 111222",
    city: "London",
    is_sitter: true,
    rate_per_hour: 18,
    experience_years: 5,
    services: { walking: true, boarding: true, daycare: true, grooming: false },
    about_me: "Passionate animal lover with 5 years of professional pet care experience. I treat every pet like my own.",
    avatar_url: null,
    last_active_at: new Date(Date.now() - 3600000).toISOString(),
    rating: 4.9,
    review_count: 47,
  },
  {
    id: "sitter-2",
    full_name: "James Okafor",
    phone: "+44 7900 222333",
    city: "London",
    is_sitter: true,
    rate_per_hour: 22,
    experience_years: 8,
    services: { walking: true, boarding: false, daycare: true, grooming: true },
    about_me: "Former veterinary nurse with 8 years experience. Specialise in nervous animals and medical needs.",
    avatar_url: null,
    last_active_at: new Date(Date.now() - 7200000).toISOString(),
    rating: 5.0,
    review_count: 83,
  },
  {
    id: "sitter-3",
    full_name: "Emma Williams",
    phone: "+44 7900 333444",
    city: "Manchester",
    is_sitter: true,
    rate_per_hour: 15,
    experience_years: 3,
    services: { walking: true, boarding: true, daycare: false, grooming: false },
    about_me: "Dog owner of 10 years. Happy to care for dogs and cats in my home or yours.",
    avatar_url: null,
    last_active_at: new Date(Date.now() - 86400000).toISOString(),
    rating: 4.7,
    review_count: 29,
  },
  {
    id: "sitter-4",
    full_name: "Priya Sharma",
    phone: "+44 7900 444555",
    city: "Birmingham",
    is_sitter: true,
    rate_per_hour: 20,
    experience_years: 6,
    services: { walking: false, boarding: true, daycare: true, grooming: true },
    about_me: "Certified pet groomer and boarding specialist. Large home with garden, all breeds welcome.",
    avatar_url: null,
    last_active_at: new Date(Date.now() - 172800000).toISOString(),
    rating: 4.8,
    review_count: 61,
  },
  {
    id: "sitter-5",
    full_name: "Tom Fletcher",
    phone: "+44 7900 555666",
    city: "London",
    is_sitter: true,
    rate_per_hour: 16,
    experience_years: 2,
    services: { walking: true, boarding: false, daycare: true, grooming: false },
    about_me: "Work from home and available most days. Love taking dogs on long walks in the park.",
    avatar_url: null,
    last_active_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    rating: 4.6,
    review_count: 18,
  },
  {
    id: "sitter-6",
    full_name: "Chloe Davies",
    phone: "+44 7900 666777",
    city: "Bristol",
    is_sitter: true,
    rate_per_hour: 24,
    experience_years: 10,
    services: { walking: true, boarding: true, daycare: true, grooming: true },
    about_me: "Professional animal trainer and carer. I offer all services and can handle exotic pets too.",
    avatar_url: null,
    last_active_at: new Date(Date.now() - 600000).toISOString(),
    rating: 5.0,
    review_count: 112,
  },
];

export const MOCK_PETS: Pet[] = [
  {
    id: "pet-1",
    owner_id: "user-1",
    name: "Biscuit",
    type: "dog",
    sex: "male",
    weight_kg: 12.5,
    bio: "Golden retriever mix, loves fetch and cuddles. Friendly with other dogs.",
    photo_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "pet-2",
    owner_id: "user-1",
    name: "Luna",
    type: "cat",
    sex: "female",
    weight_kg: 4.2,
    bio: "Shy at first but warms up quickly. Needs her own space.",
    photo_url: null,
    created_at: new Date().toISOString(),
  },
];

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: "booking-1",
    owner_id: "user-1",
    sitter_id: "sitter-1",
    pet_id: "pet-1",
    service: "walking",
    start_at: new Date(Date.now() + 86400000 * 2).toISOString(),
    end_at: new Date(Date.now() + 86400000 * 2 + 3600000).toISOString(),
    address: "Hyde Park, London",
    notes: "Biscuit loves the pond area",
    status: "signed",
    created_at: new Date().toISOString(),
    sitter: MOCK_SITTERS[0],
    pet: MOCK_PETS[0],
  },
  {
    id: "booking-2",
    owner_id: "user-1",
    sitter_id: "sitter-2",
    pet_id: "pet-2",
    service: "boarding",
    start_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    end_at: new Date(Date.now() + 86400000 * 10).toISOString(),
    address: null,
    notes: "Luna needs her wet food twice a day",
    status: "pending",
    created_at: new Date().toISOString(),
    sitter: MOCK_SITTERS[1],
    pet: MOCK_PETS[1],
  },
];

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
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800" },
  signed: { label: "Confirmed", color: "bg-green-100 text-green-800" },
  declined: { label: "Declined", color: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", color: "bg-stone-100 text-stone-600" },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-800" },
};
