"use client";
import CollarPage from "@/components/collar/CollarPage";
import { useLanguage } from "@/context/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";

/** The GPS collar (showcase, 2026-09-26). Everything lives in the component and the provider. */
export default function CollarRoute() {
  const { t } = useLanguage();
  usePageTitle(t("appPages.collar.pageLabel"));
  return <CollarPage />;
}
