"use client";
import { Fingerprint } from "lucide-react";
import SmartIdDemo from "@/components/SmartIdDemo";
import { useLanguage } from "@/context/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { notifyProfileChanged } from "@/hooks/useProfile";

/**
 * Smart-ID identity verification against SK's demo environment, made to look like the real login
 * (Lukas, 2026-09-26). Reached from the sidebar's Smart-ID card; saving the badge refreshes every
 * profile reader, so that card flips to "verified" at once.
 */
export default function SmartIdDemoPage() {
  const { t } = useLanguage();
  usePageTitle(t("appPages.smartIdDemo.title"));
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-10">
      {/* The page's band, with the DEMO marker beside the title where it can never be missed. */}
      <header className="pb-band rounded-[var(--radius-hero)] border border-[var(--chrome-line)] px-5 py-5 sm:px-8 sm:py-7">
        <div className="flex items-center gap-3.5">
          <span aria-hidden="true" className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[var(--radius-control)] border border-[var(--chrome-line)] bg-[var(--chrome-active)] text-[var(--hero-accent)]">
            <Fingerprint className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-chrome-ink-soft">{t("appPages.smartIdDemo.pageLabel")}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-chrome-ink sm:text-4xl">{t("appPages.smartIdDemo.title")}</h1>
              <span className="rounded-md bg-amber-soft px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-strong">
                {t("appPages.smartIdDemo.demoPill")}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-chrome-ink-soft sm:text-base">{t("appPages.smartIdDemo.subtitle")}</p>
      </header>
      <div className="mt-6 sm:mt-8">
        <SmartIdDemo onVerified={notifyProfileChanged} />
      </div>
    </div>
  );
}
