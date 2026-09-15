"use client";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import StatusPage, { statusPrimaryClass } from "@/components/StatusPage";

/** Every unmatched URL, and any notFound() call, in the site's own frame. */
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <StatusPage code="404" title={t("common.notFound.title")} body={t("common.notFound.body")}>
      <Link href="/" className={statusPrimaryClass}>{t("common.notFound.home")}</Link>
    </StatusPage>
  );
}
