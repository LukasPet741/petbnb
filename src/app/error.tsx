"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import StatusPage, { statusPrimaryClass, statusSecondaryClass } from "@/components/StatusPage";

/**
 * A crash anywhere below the root layout. The error's message is logged, never shown: in
 * production a server error's message is a generic digest, and a client error's can name
 * tables or columns.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage code="!" title={t("common.error.title")} body={t("common.error.body")}>
      <button type="button" onClick={() => unstable_retry()} className={statusPrimaryClass}>
        {t("common.error.retry")}
      </button>
      <Link href="/" className={statusSecondaryClass}>{t("common.error.home")}</Link>
    </StatusPage>
  );
}
