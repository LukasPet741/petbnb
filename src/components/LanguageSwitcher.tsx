"use client";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className={`inline-flex items-center rounded-full border border-ink/10 bg-surface p-0.5 text-xs font-medium ${className}`} role="group" aria-label={t("common.languageLabel")}>
      {(["en", "lt"] as const).map((code) => (
        <button
          key={code}
          type="button"
          suppressHydrationWarning
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            locale === code ? "bg-brand text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
