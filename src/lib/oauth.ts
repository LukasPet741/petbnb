import { supabase } from "./supabase";

/**
 * Social sign-in (Google, Facebook) through Supabase Auth.
 *
 * Shipped dark: no button shows until NEXT_PUBLIC_AUTH_PROVIDERS names the providers, which
 * is set (in Vercel) only once each provider's app exists and is switched on in Supabase >
 * Auth > Providers. A button that could only fail never reaches a visitor.
 */

export type OAuthProvider = "google" | "facebook";

const ORDER: OAuthProvider[] = ["google", "facebook"];

/** The switched-on providers, in a fixed order, from a comma list like "facebook,google". */
export function enabledProviders(list: string | undefined = process.env.NEXT_PUBLIC_AUTH_PROVIDERS): OAuthProvider[] {
  const named = new Set((list ?? "").split(",").map((s) => s.trim().toLowerCase()));
  return ORDER.filter((p) => named.has(p));
}

export const PROVIDER_NAMES: Record<OAuthProvider, string> = { google: "Google", facebook: "Facebook" };

/**
 * Leaves for the provider and comes back signed in. The return address must be in
 * Supabase Auth's redirect URL list. A brand-new account lands on the dashboard, which
 * sends it on to finish its profile (app/(app)/layout.tsx).
 */
export async function signInWithProvider(provider: OAuthProvider, next: string | null) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}${next ?? "/dashboard"}` },
  });
  if (error) throw error;
}
