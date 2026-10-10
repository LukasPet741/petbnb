"use client";
import { useState } from "react";
import { matchAuthErrorKey, resendSignupEmail } from "@/lib/auth";
import { useLanguage } from "@/context/LanguageContext";

/**
 * "Send the email again" for an account whose email is not confirmed yet: on the check-your-email
 * screen after signing up, and under the sign-in error that says the email is not confirmed.
 */
export default function ResendConfirmation({ email }: { email: string }) {
  const { t } = useLanguage();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const send = async () => {
    setState("sending");
    setError("");
    try {
      await resendSignupEmail(email);
      setState("sent");
    } catch (err: unknown) {
      const key = err instanceof Error ? matchAuthErrorKey(err.message) : null;
      setError(t(key ?? "auth.signup.checkEmail.resendFailed"));
      setState("idle");
    }
  };

  return (
    <div className="text-sm">
      <button type="button" onClick={send} disabled={state === "sending" || !email}
        className="font-medium text-brand hover:underline disabled:opacity-60">
        {t("auth.signup.checkEmail.resend")}
      </button>
      {state === "sent" && <p role="status" className="mt-1.5 text-ink-soft">{t("auth.signup.checkEmail.resent")}</p>}
      {error && <p role="alert" className="mt-1.5 text-danger">{error}</p>}
    </div>
  );
}
