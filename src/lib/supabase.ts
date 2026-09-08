import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          city: string | null;
          is_sitter: boolean;
          rate_per_hour: number | null;
          experience_years: number | null;
          services: Record<string, boolean> | null;
          about_me: string | null;
          avatar_url: string | null;
          last_active_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      pets: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          type: string;
          sex: string | null;
          weight_kg: number | null;
          bio: string | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pets"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["pets"]["Insert"]>;
      };
      bookings: {
        Row: {
          id: string;
          owner_id: string;
          sitter_id: string;
          pet_id: string;
          service: string;
          start_at: string;
          end_at: string;
          address: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bookings"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          owner_id: string;
          sitter_id: string;
          rating: number;
          body: string | null;
          created_at: string;
        };
        // owner_id and sitter_id stay required on insert: the RLS policy checks both
        // against the booking, so the client must send what it believes them to be
        // rather than letting the database infer them.
        Insert: Omit<Database["public"]["Tables"]["reviews"]["Row"], "id" | "created_at">;
        Update: Partial<
          Pick<Database["public"]["Tables"]["reviews"]["Row"], "rating" | "body">
        >;
      };
    };
    Views: {
      // Derived from public.reviews, never written to. Declared read-only here so a
      // stray .insert() on it is a type error rather than a runtime one.
      sitter_ratings: {
        Row: {
          sitter_id: string;
          review_count: number;
          average_rating: number;
        };
      };
    };
  };
};
