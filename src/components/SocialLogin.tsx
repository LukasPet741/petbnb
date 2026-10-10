"use client";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { enabledProviders, PROVIDER_NAMES, signInWithProvider, type OAuthProvider } from "@/lib/oauth";
import { buttonClasses } from "@/components/ui/Button";
import MoonLoader from "@/components/ui/MoonLoader";
import { cn } from "@/lib/utils";

/**
 * "Continue with Google / Facebook" above the email form on /login and /signup. Renders
 * nothing until a provider is switched on (lib/oauth.ts). The providers' own marks, from
 * /oauth/*.svg, are the one place their colours appear — their brand rules ask for them.
 */
export default function SocialLogin({
  providers = enabledProviders(),
  next,
}: {
  providers?: OAuthProvider[];
  next: string | null;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [failed, setFailed] = useState<OAuthProvider | null>(null);

  if (!providers.length) return null;

  const go = async (provider: OAuthProvider) => {
    setFailed(null);
    setBusy(provider);
    try {
      await signInWithProvider(provider, next);
      // On success the browser is already leaving for the provider; keep the wait showing.
    } catch {
      setFailed(provider);
      setBusy(null);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-2.5">
        {providers.map((p) => (
          <button
            key={p}
            type="button"
            data-provider={p}
            onClick={() => void go(p)}
            disabled={busy !== null}
            aria-busy={busy === p || undefined}
            className={cn(buttonClasses({ variant: "secondary", size: "lg", block: true }), "gap-3")}
          >
            {busy === p ? (
              <MoonLoader bare size={20} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a fixed 20px brand mark, nothing to optimise
              <img src={`/oauth/${p}.svg`} alt="" width={20} height={20} />
            )}
            {t("auth.social.continueWith", { provider: PROVIDER_NAMES[p] })}
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {t("auth.social.failed", { provider: PROVIDER_NAMES[failed] })}
        </p>
      )}
      <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-soft" aria-hidden="true">
        <span className="h-px flex-1 bg-ink/10" />
        {t("auth.social.or")}
        <span className="h-px flex-1 bg-ink/10" />
      </div>
    </div>
  );
}
