"use client";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className={`inline-flex items-center rounded-full border border-ink/10 bg-surface p-0.5 text-xs font-semibold ${className}`} role="group" aria-label={t("common.languageLabel")}>
      {(["en", "lt"] as const).map((code) => (
        <button
          key={code}
          type="button"
          suppressHydrationWarning
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          // Drawn at 32px so the control sits level with the header's buttons; at a drawn
          // 44px it towered over them. The ::before restores the 44px touch target.
          className={`relative h-8 min-w-10 px-2.5 inline-flex items-center justify-center rounded-full transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${
            locale === code ? "bg-brand text-white shadow-[var(--shadow-sm)]" : "text-ink-soft hover:text-ink"
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
