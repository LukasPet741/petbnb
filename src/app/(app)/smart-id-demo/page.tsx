"use client";
import SmartIdDemo from "@/components/SmartIdDemo";
import { useLanguage } from "@/context/LanguageContext";
import { notifyProfileChanged } from "@/hooks/useProfile";

/**
 * Smart-ID identity verification against SK's demo environment, made to look like the real login
 * (Lukas, 2026-09-26). Reached from the sidebar's Smart-ID card; saving the badge refreshes every
 * profile reader, so that card flips to "verified" at once.
 */
export default function SmartIdDemoPage() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.smartIdDemo.pageLabel")}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{t("appPages.smartIdDemo.title")}</h1>
        <span className="rounded-md bg-amber-soft px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-strong">
          {t("appPages.smartIdDemo.demoPill")}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft sm:text-base">{t("appPages.smartIdDemo.subtitle")}</p>
      <div className="mt-8">
        <SmartIdDemo onVerified={notifyProfileChanged} />
      </div>
    </div>
  );
}
