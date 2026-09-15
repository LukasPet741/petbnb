"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * The things a visitor would otherwise only find by reading the terms: no fees, no
 * checks on profiles, no insurance, where the data lives.
 *
 * Two reasons this earns its place rather than padding the page. It is the only
 * content here that a commercial marketplace could not copy — the absences are the
 * differentiator. And it is the honest counterweight to a site that otherwise looks
 * like a real booking platform: someone about to hand over their animal should know
 * nobody checked the person.
 *
 * An accordion since 2026-09-15 (landing variant B): four titles read at a glance, and
 * the first stays open so the section never looks empty. Native <details>, so it opens
 * with the keyboard and without JavaScript.
 */
const POINTS = ["fees", "vetting", "insurance", "data"] as const;

export default function Honest() {
  const { t } = useLanguage();

  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-16">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
          {t("home.honest.title")}
        </h2>

        <div className="mt-6 rounded-[var(--radius-card)] glass-card border px-5 sm:px-6">
          {POINTS.map((key, i) => (
            <details key={key} open={i === 0} className="group border-b border-ink/8 last:border-b-0">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {t(`home.honest.points.${key}.title`)}
                <Plus
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-brand transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-2xl pb-4 pr-9 text-sm leading-relaxed text-ink-soft">
                {t(`home.honest.points.${key}.body`)}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/legal/terms" className="text-brand hover:underline">
            {t("home.honest.termsLink")}
          </Link>
          <Link href="/legal/privacy" className="text-brand hover:underline">
            {t("home.honest.privacyLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}
