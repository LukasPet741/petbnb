"use client";
import { Plus } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const ITEMS = ["howItWorks", "cost", "areas", "becomeSitter", "realCompany"] as const;

/**
 * The same accordion as "What we do, and what we don't" (Honest.tsx), so the two sections that
 * sit back to back read as one family: one card, hairline dividers, a plus that turns into a
 * cross. Native <details>, so it opens before the page hydrates and needs no state.
 */
export default function Faq() {
  const { t } = useLanguage();

  return (
    <section id="faq" className="scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-16">
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink tracking-tight">
          {t("home.faq.title")}
        </h2>

        <div className="mt-6 rounded-[var(--radius-card)] glass-card border px-5 sm:px-6">
          {ITEMS.map((key, i) => (
            <details key={key} open={i === 0} className="group border-b border-ink/8 last:border-b-0">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {t(`home.faq.items.${key}.q`)}
                <Plus
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-brand transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-2xl pb-4 pr-9 text-sm leading-relaxed text-ink-soft">
                {t(`home.faq.items.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
