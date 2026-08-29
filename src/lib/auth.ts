import { supabase } from "./supabase";

const AUTH_ERROR_KEYS: [RegExp, string][] = [
  [/invalid login credentials/i, "invalidCredentials"],
  [/user already registered/i, "userAlreadyRegistered"],
  [/email not confirmed/i, "emailNotConfirmed"],
  [/password should be at least/i, "weakPassword"],
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
