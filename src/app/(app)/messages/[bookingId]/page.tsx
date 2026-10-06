"use client";
import { useParams } from "next/navigation";
import MessageThread from "@/components/MessageThread";
import { useLanguage } from "@/context/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function MessageThreadPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { t } = useLanguage();
  usePageTitle(t("messages.title"));
  return <MessageThread bookingId={bookingId} />;
}
