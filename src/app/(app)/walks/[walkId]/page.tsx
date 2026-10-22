"use client";
import { useParams } from "next/navigation";
import WalkScreen from "@/components/collar/WalkScreen";
import { useLanguage } from "@/context/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function WalkPage() {
  const { walkId } = useParams<{ walkId: string }>();
  const { t } = useLanguage();
  usePageTitle(t("appPages.collar.walks.title"));
  return <WalkScreen walkId={walkId} />;
}
