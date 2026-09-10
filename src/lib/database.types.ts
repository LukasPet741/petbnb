// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced verbatim by `supabase gen types typescript` against project
// jktykrbvwgagcjyuxypo (petbnb). Regenerate rather than patching: the whole point
// of keeping it verbatim is that the next generator run is a readable diff.
//
// Deliberate deviations from this shape live in `./supabase.ts`, next to the
// reason for each. Nothing else should import this file directly.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          address: string | null
          created_at: string | null
          end_at: string
          id: string
          notes: string | null
          owner_id: string
          pet_id: string
          service: string
          sitter_id: string
          start_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          end_at: string
          id?: string
          notes?: string | null
          owner_id: string
          pet_id: string
          service: string
          sitter_id: string
          start_at: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          end_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          pet_id?: string
          service?: string
          sitter_id?: string
          start_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collar_devices: {
        Row: {
          created_at: string
          device_secret_hash: string
          id: string
          label: string | null
          owner_id: string
        }
        Insert: {
          created_at?: string
          device_secret_hash: string
          id?: string
          label?: string | null
          owner_id: string
        }
        Update: {
          created_at?: string
          device_secret_hash?: string
          id?: string
          label?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collar_devices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collar_locations: {
        Row: {
          battery_pct: number | null
          created_at: string
          device_id: string
          id: number
          lat: number
          lng: number
          recorded_at: string
          speed_kmh: number | null
        }
        Insert: {
          battery_pct?: number | null
          created_at?: string
          device_id: string
          id?: never
          lat: number
          lng: number
          recorded_at?: string
          speed_kmh?: number | null
        }
        Update: {
          battery_pct?: number | null
          created_at?: string
          device_id?: string
          id?: never
          lat?: number
          lng?: number
          recorded_at?: string
          speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collar_locations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "collar_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          sitter_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          sitter_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          sitter_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          booking_id: string
          created_at: string
          event: string | null
          id: string
          kind: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          booking_id: string
          created_at?: string
          event?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          booking_id?: string
          created_at?: string
          event?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          booking_id: string | null
          created_at: string
          email_error: string | null
          email_status: string
          id: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          booking_id?: string | null
          created_at?: string
          email_error?: string | null
          email_status?: string
          id?: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string | null
          created_at?: string
          email_error?: string | null
          email_status?: string
          id?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          name: string
          owner_id: string
          photo_url: string | null
          sex: string | null
          type: string
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
          photo_url?: string | null
          sex?: string | null
          type: string
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          photo_url?: string | null
          sex?: string | null
          type?: string
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about_me: string | null
          avatar_url: string | null
          city: string | null
          created_at: string | null
          experience_years: number | null
          full_name: string | null
          id: string
          is_sitter: boolean | null
          is_verified: boolean
          last_active_at: string | null
          locale: string
          phone: string | null
          rate_per_hour: number | null
          services: Json | null
          smart_id_session_id: string | null
          updated_at: string | null
          verified_at: string | null
          verified_full_name: string | null
        }
        Insert: {
          about_me?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          experience_years?: number | null
          full_name?: string | null
          id: string
          is_sitter?: boolean | null
          is_verified?: boolean
          last_active_at?: string | null
          locale?: string
          phone?: string | null
          rate_per_hour?: number | null
          services?: Json | null
          smart_id_session_id?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_full_name?: string | null
        }
        Update: {
          about_me?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          experience_years?: number | null
          full_name?: string | null
          id?: string
          is_sitter?: boolean | null
          is_verified?: boolean
          last_active_at?: string | null
          locale?: string
          phone?: string | null
          rate_per_hour?: number | null
          services?: Json | null
          smart_id_session_id?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_full_name?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_id: string
          body: string | null
          booking_id: string
          communication: number | null
          created_at: string
          direction: string
          handover: number | null
          id: string
          pet_as_described: number | null
          pet_wellbeing: number | null
          rating: number
          reliability: number | null
          subject_id: string
        }
        Insert: {
          author_id: string
          body?: string | null
          booking_id: string
          communication?: number | null
          created_at?: string
          direction: string
          handover?: number | null
          id?: string
          pet_as_described?: number | null
          pet_wellbeing?: number | null
          rating: number
          reliability?: number | null
          subject_id: string
        }
        Update: {
          author_id?: string
          body?: string | null
          booking_id?: string
          communication?: number | null
          created_at?: string
          direction?: string
          handover?: number | null
          id?: string
          pet_as_described?: number | null
          pet_wellbeing?: number | null
          rating?: number
          reliability?: number | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      owner_ratings: {
        Row: {
          average_rating: number | null
          avg_communication: number | null
          avg_handover: number | null
          avg_pet_as_described: number | null
          owner_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_subject_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sitter_ratings: {
        Row: {
          average_rating: number | null
          avg_communication: number | null
          avg_pet_wellbeing: number | null
          avg_reliability: number | null
          review_count: number | null
          sitter_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_subject_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_booking_party: { Args: { p_booking_id: string }; Returns: boolean }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      mark_thread_read: { Args: { p_booking_id: string }; Returns: number }
      register_collar_device: {
        Args: { p_label?: string; p_secret: string }
        Returns: string
      }
      verify_collar_device: {
        Args: { p_device_id: string; p_secret: string }
        Returns: {
          owner_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
