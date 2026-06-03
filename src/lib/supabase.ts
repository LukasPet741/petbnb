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
    };
  };
};
