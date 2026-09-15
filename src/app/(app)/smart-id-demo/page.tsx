"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SmartIdDemo from "@/components/SmartIdDemo";
import { useLanguage } from "@/context/LanguageContext";

/** Smart-ID identity verification, shown against SK's demo environment (option B, 2026-09-15). */
export default function SmartIdDemoPage() {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t("appPages.smartIdDemo.back")}
      </Link>
      <PageHeader title={t("appPages.smartIdDemo.title")} subtitle={t("appPages.smartIdDemo.subtitle")} />
      <SmartIdDemo />
    </div>
  );
}
