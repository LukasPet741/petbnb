/**
 * Remembers that this tab arrived on a password-reset link.
 *
 * `/reset-password` used to render its "choose a new password" form for any signed-in
 * session at all, because a recovery session and an ordinary one look identical to
 * `useAuth()`. Supabase does not ask for the current password, so anyone with a minute
 * at an unlocked browser could walk to that URL and take the account over permanently.
 * The page now needs this marker as well as a session.
 *
 * Why sessionStorage rather than React state: the recovery session survives a refresh
 * and a client-side navigation, but the PASSWORD_RECOVERY event does not fire again, so
 * state would drop the marker and show the genuine user an "expired link" screen.
 * It is scoped to the tab and cleared once the password is saved.
 *
 * Every access is wrapped: sessionStorage throws in a private window with site data
 * blocked, and a thrown storage error must not take the page down.
 */
const RECOVERY_KEY = "petbnb:password-recovery";

/**
 * Reads the recovery marker out of the URL before the Supabase client starts.
 *
 * Supabase's reset link lands with `#access_token=…&type=recovery`, and creating the
 * client consumes that hash and wipes it from the address bar — so this has to run
 * first, at module load in lib/supabase.ts. The PASSWORD_RECOVERY event is also
 * listened for (AuthContext), but the event can fire before the listener is attached;
 * the URL cannot.
 */
export function capturePasswordRecoveryFromUrl() {
  if (typeof window === "undefined") return;
  const url = `${window.location.hash}${window.location.search}`;
  if (/(^|[#&?])type=recovery([&#]|$)/.test(url)) markPasswordRecovery();
}

export function markPasswordRecovery() {
  try {
    window.sessionStorage.setItem(RECOVERY_KEY, "1");
  } catch {
    // Storage unavailable — the reset link still works, it just cannot be told apart
    // from an ordinary session, and the page will ask for a fresh link.
  }
}

export function isPasswordRecovery(): boolean {
  try {
    return window.sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPasswordRecovery() {
  try {
    window.sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Nothing to do; the marker dies with the tab either way.
  }
}
