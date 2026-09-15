import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { nextFromSearch } from "@/lib/next-path";

/**
 * Sends someone who arrives already signed in on to where they were going — the page's safe
 * ?next=, else the dashboard — for /login and /signup.
 *
 * It decides once, the first time the session is known, and never again. A visitor who
 * arrives signed out and then signs in through the form is left to the form, which
 * navigates on its own (signup goes to /profile); reacting to the session appearing
 * would race that push.
 */
export function useRedirectIfSignedIn() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const decided = useRef(false);

  useEffect(() => {
    if (loading || decided.current) return;
    decided.current = true;
    if (user) router.replace(nextFromSearch(window.location.search) ?? "/dashboard");
  }, [loading, user, router]);
}
