"use client";
import { STATUS_CONFIG, type BookingStatus } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

const DOT: Record<BookingStatus, string> = {
  pending: "bg-amber",
  signed: "bg-brand",
  declined: "bg-danger",
  cancelled: "bg-ink-soft",
  completed: "bg-brand",
};

/** One pill per booking status, the same everywhere (plan §2.3). */
export default function StatusPill({ status, className }: { status: string; className?: string }) {
  const { t } = useLanguage();
  const config = STATUS_CONFIG[status as BookingStatus];
  return (
    <span className={cn("inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold flex-shrink-0", config?.color, className)}>
      <span aria-hidden="true" className={cn("w-1.5 h-1.5 rounded-full", DOT[status as BookingStatus] ?? "bg-ink-soft")} />
      {t(`common.bookingStatus.${status}`)}
    </span>
  );
}
