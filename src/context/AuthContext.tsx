"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { PASSWORD_RESET_PATH } from "@/lib/auth";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      // An unreadable session is a signed-out one; without this every page would spin forever.
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // A reset link normally lands on /reset-password, but when Supabase does not accept that
      // redirect it falls back to the Site URL. Wherever the link landed, finish the reset there.
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== PASSWORD_RESET_PATH) {
        router.replace(PASSWORD_RESET_PATH);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
