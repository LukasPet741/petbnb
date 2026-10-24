"use client";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * EN | LT. `onChrome` is for the deep-green header and app rail, where the light pill used to
 * be the brightest thing on the bar; there it is a quiet chip with the leaf green for the
 * active language.
 */
export default function LanguageSwitcher({ className = "", onChrome = false }: { className?: string; onChrome?: boolean }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border p-0.5 text-xs font-semibold",
        onChrome ? "border-[var(--chrome-line)] bg-[var(--chrome-active)]" : "border-ink/10 bg-surface",
        className,
      )}
      role="group"
      aria-label={t("common.languageLabel")}
    >
      {(["en", "lt"] as const).map((code) => (
        <button
          key={code}
          type="button"
          suppressHydrationWarning
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          // Drawn at 32px so the control sits level with the header's buttons; at a drawn
          // 44px it towered over them. The ::before restores the 44px touch target.
          className={cn(
            "relative h-8 min-w-10 px-2.5 inline-flex items-center justify-center rounded-full transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
            locale === code
              ? onChrome
                ? "bg-brand-leaf text-brand-deep"
                : "bg-brand text-on-brand shadow-[var(--shadow-sm)]"
              : onChrome
                ? "text-chrome-ink-soft hover:text-chrome-ink"
                : "text-ink-soft hover:text-ink",
          )}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
