"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import Logo from "@/components/Logo";

export default function TermsPage() {
  const { t } = useLanguage();
  const sections = [
    {
      title: t("auth.terms.sections.aboutProject.heading"),
      body: t("auth.terms.sections.aboutProject.body"),
    },
    {
      title: t("auth.terms.sections.acceptance.heading"),
      body: t("auth.terms.sections.acceptance.body"),
    },
    {
      title: t("auth.terms.sections.userAccounts.heading"),
      body: t("auth.terms.sections.userAccounts.body"),
    },
    {
      title: t("auth.terms.sections.bookings.heading"),
      body: t("auth.terms.sections.bookings.body"),
    },
    {
      title: t("auth.terms.sections.payments.heading"),
      body: t("auth.terms.sections.payments.body"),
    },
    {
      title: t("auth.terms.sections.sitters.heading"),
      body: t("auth.terms.sections.sitters.body"),
    },
    {
      title: t("auth.terms.sections.liability.heading"),
      body: t("auth.terms.sections.liability.body"),
    },
    {
      title: t("auth.terms.sections.privacy.heading"),
      body: t("auth.terms.sections.privacy.body"),
    },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-canvas/80 backdrop-blur-md border-b border-black/5 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
          <Link href="/">
            <Logo size={32} showWordmark />
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("auth.terms.backLink")}
        </Link>

        <h1 className="font-display text-4xl font-semibold text-ink mb-2 tracking-tight">{t("common.terms")}</h1>
        <p className="text-ink-soft mb-8">{t("auth.terms.lastUpdated")}</p>

        <div className="space-y-4">
          {sections.map(({ title, body }) => (
            <div key={title} className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6">
              <h2 className="font-semibold text-ink mb-2.5">{title}</h2>
              <p className="text-ink-soft text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-ink-soft text-sm">
            {t("auth.terms.questionsPrefix")}{" "}
            <a href="mailto:hello@petbnb.lt" className="text-brand hover:underline">{t("auth.terms.contactUs")}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
