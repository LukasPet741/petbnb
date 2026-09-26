import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Database } from "@/lib/supabase";

type Profile = Database["public"]["Views"]["my_profile"]["Row"];

const listeners = new Set<() => void>();

/**
 * Every mounted useProfile() reads the profile again. Each component holds its own copy, so
 * without this the sidebar's Smart-ID card stayed "not verified" until a reload after the badge
 * was saved on the Smart-ID page.
 */
export function notifyProfileChanged(): void {
  for (const listener of listeners) listener();
}

/**
 * Own profile, read through the `my_profile` view rather than the profiles table.
 *
 * `authenticated` holds a SELECT grant on only the public columns of profiles, so
 * `select("*")` there is an error and `phone` is not among the columns it can name.
 * The view is `where id = auth.uid()`, which is the one place a phone number is
 * legitimately readable: your own.
 */
export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    supabase
      .from("my_profile")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [user, authLoading]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("my_profile").select("*").maybeSingle();
    // A failed read keeps what we had: a null profile reads as incomplete, and the app layout
    // then bounces to /profile (review I3, 2026-09-26).
    if (error) return;
    setProfile(data);
  }, [user]);

  useEffect(() => {
    const listener = () => void refresh();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [refresh]);

  const isComplete = !!(profile?.full_name && profile?.phone && profile?.city);

  return { profile, loading: loading || authLoading, isComplete, refresh };
}
