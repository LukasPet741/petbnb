import { createClient } from "@supabase/supabase-js";
import type { Database as Generated } from "./database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type { Json } from "./database.types";

/**
 * Swaps the `services` column's generated `Json` for the flat map it actually holds.
 * Homomorphic, so Row keeps `services` required and Insert/Update keep it optional.
 */
type WithServiceMap<T> = {
  [K in keyof T]: K extends "services" ? Record<string, boolean> | null : T[K];
};

/**
 * The generated schema with three deliberate narrowings. Everything not mentioned
 * here is exactly what `supabase gen types` produced — see ./database.types.ts,
 * and regenerate that file rather than editing either by hand.
 *
 * 1. `reviews.Update` is restricted to rating and body. The RLS policy re-checks
 *    owner_id and sitter_id against the booking on every UPDATE, so changing them
 *    can only ever fail at the database. Narrowing it here makes that a type error
 *    instead of a round trip.
 *
 * 2. `profiles.services` is a flat service-name to boolean map, not arbitrary Json.
 *    The column is jsonb, so the generator can only say `Json`, which admits arrays
 *    and bare strings and therefore does not overlap the app's own `Profile` type at
 *    all. Nothing but this app writes the column, and it only ever writes the map.
 *
 * 3. `sitter_ratings`'s three columns are non-null. The generator marks every view
 *    column nullable because Postgres will not prove otherwise through a view, but
 *    the view is `select sitter_id, count(*), avg(rating) ... group by sitter_id`
 *    over a table whose sitter_id and rating are both NOT NULL: a group only exists
 *    because it has rows, so count is never null, avg is never null, and the group
 *    key is never null. Taking the generated nullability literally would mean three
 *    null guards for cases the view cannot produce.
 */
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Tables" | "Views"> & {
    Tables: Omit<Generated["public"]["Tables"], "reviews" | "profiles"> & {
      reviews: Omit<Generated["public"]["Tables"]["reviews"], "Update"> & {
        Update: Partial<
          Pick<
            Generated["public"]["Tables"]["reviews"]["Row"],
            | "rating"
            | "body"
            | "communication"
            | "pet_wellbeing"
            | "reliability"
            | "pet_as_described"
            | "handover"
          >
        >;
      };
      profiles: {
        Row: WithServiceMap<Generated["public"]["Tables"]["profiles"]["Row"]>;
        Insert: WithServiceMap<Generated["public"]["Tables"]["profiles"]["Insert"]>;
        Update: WithServiceMap<Generated["public"]["Tables"]["profiles"]["Update"]>;
        Relationships: Generated["public"]["Tables"]["profiles"]["Relationships"];
      };
    };
    Views: Omit<Generated["public"]["Views"], "sitter_ratings" | "owner_ratings"> & {
      sitter_ratings: Omit<Generated["public"]["Views"]["sitter_ratings"], "Row"> & {
        Row: {
          sitter_id: string;
          review_count: number;
          average_rating: number;
          // These stay nullable, unlike the three above: a dimension average is only
          // non-null once somebody has actually rated that dimension, and every one
          // of them is optional to fill in.
          avg_communication: number | null;
          avg_pet_wellbeing: number | null;
          avg_reliability: number | null;
        };
      };
      owner_ratings: Omit<Generated["public"]["Views"]["owner_ratings"], "Row"> & {
        Row: {
          owner_id: string;
          review_count: number;
          average_rating: number;
          avg_communication: number | null;
          avg_pet_as_described: number | null;
          avg_handover: number | null;
        };
      };
      /**
       * 4. `my_profile` is added by hand because it did not exist when
       *    database.types.ts was last generated — see migration 20260910170000.
       *    Delete this block the next time that file is regenerated.
       *
       *    It is the caller's own profile row and nothing else: the view is
       *    `where id = auth.uid()`, so it returns exactly one row or none. It exists
       *    because `authenticated` no longer holds a table-level SELECT on profiles,
       *    and a column grant cannot say "this column, but only on your own row".
       *    Read-only by design — writes still go to the profiles table, where the
       *    existing `auth.uid() = id` policy governs them.
       */
      my_profile: {
        Row: Generated["public"]["Tables"]["profiles"]["Row"] extends infer R
          ? WithServiceMap<R>
          : never;
        Relationships: [];
      };
    };
  };
};

export const supabase = createClient<Database>(url, anon);
