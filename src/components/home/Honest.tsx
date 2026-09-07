"use client";
import Link from "next/link";
import { Wallet, ShieldOff, Umbrella, Server } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * The things a visitor would otherwise only find by reading the terms: no fees, no
 * vetting, no insurance, data in the EU.
 *
 * Two reasons this earns its place rather than padding the page. It is the only
 * content here that a commercial marketplace could not copy — the absences are the
 * differentiator. And it is the honest counterweight to a site that otherwise looks
 * like a real booking platform: someone about to hand over their animal should know
 * nobody checked the sitter.
 */
const POINTS = [
  { key: "fees", icon: Wallet },
  { key: "vetting", icon: ShieldOff },
  { key: "insurance", icon: Umbrella },
  { key: "data", icon: Server },
] as const;

export default function Honest() {
  const { t } = useLanguage();

  return (
    <section className="border-t border-black/5">
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-16">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
          {t("home.honest.title")}
        </h2>
        <p className="text-ink-soft mt-2 mb-8 max-w-2xl">{t("home.honest.subtitle")}</p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {POINTS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="flex gap-4 rounded-[var(--radius-card)] border border-black/5 bg-surface p-5 shadow-[var(--shadow-sm)]"
            >
              <span
                aria-hidden
                className="shrink-0 w-9 h-9 rounded-full bg-brand-softer flex items-center justify-center"
              >
                <Icon className="w-4 h-4 text-brand" />
              </span>
              <div>
                <h3 className="font-semibold text-ink mb-1">
                  {t(`home.honest.points.${key}.title`)}
                </h3>
                <p className="text-sm text-ink-soft leading-relaxed">
                  {t(`home.honest.points.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ul>

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
