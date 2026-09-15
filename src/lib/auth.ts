import { supabase } from "./supabase";

const AUTH_ERROR_KEYS: [RegExp, string][] = [
  [/invalid login credentials/i, "invalidCredentials"],
  [/user already registered/i, "userAlreadyRegistered"],
  [/email not confirmed/i, "emailNotConfirmed"],
  [/password should be at least/i, "weakPassword"],
  // Supabase words its mail throttle two ways: the project-wide hourly cap and the per-address wait.
  [/email rate limit exceeded|you can only request this after/i, "rateLimited"],
  [/should be different from the old password/i, "samePassword"],
  // updateUser without a session: the recovery link expired, was used, or was opened in another browser.
  [/auth session missing/i, "linkExpired"],
];

/** Maps a raw Supabase Auth error message to a `auth.knownErrors.*` i18n key, or null if unrecognized. */
export function matchAuthErrorKey(message: string): string | null {
  const match = AUTH_ERROR_KEYS.find(([pattern]) => pattern.test(message));
  return match ? `auth.knownErrors.${match[1]}` : null;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Where a password-reset email sends people back to. Must be in Supabase Auth's redirect URL list. */
export const PASSWORD_RESET_PATH = "/reset-password";

/**
 * Asks Supabase to email a reset link to this address. Supabase answers the same whether or not
 * an account exists, so callers must not tell the visitor which it was.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${PASSWORD_RESET_PATH}`,
  });
  if (error) throw error;
}

/** Sets a new password for whoever is signed in — after a reset link, that is the recovery session. */
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
