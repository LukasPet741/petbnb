import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Database } from "@/lib/supabase";

type Profile = Database["public"]["Views"]["my_profile"]["Row"];

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

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase.from("my_profile").select("*").maybeSingle();
    setProfile(data);
  };

  const isComplete = !!(profile?.full_name && profile?.phone && profile?.city);

  return { profile, loading: loading || authLoading, isComplete, refresh };
}
