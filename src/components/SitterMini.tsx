"use client";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import Avatar from "./Avatar";
import type { Profile } from "@/lib/types";

/** Buckets a sitter's last_active_at into a coarse, non-exact trust signal.
 *  Returns null for anything older than a week so long-dormant sitters show nothing. */
type ActivityBucket = "now" | "today" | "week";
const ACTIVITY_DOT_CLASS: Record<ActivityBucket, string> = {
  now: "bg-brand",
  today: "bg-brand/60",
  week: "bg-ink-soft/40",
};
export function getActivityBucket(lastActiveAt: string | null | undefined): ActivityBucket | null {
  if (!lastActiveAt) return null;
  const lastActiveMs = new Date(lastActiveAt).getTime();
  if (Number.isNaN(lastActiveMs)) return null;
  const minutesAgo = (Date.now() - lastActiveMs) / 60000;
  if (minutesAgo <= 15) return "now";
  if (minutesAgo <= 60 * 24) return "today";
  if (minutesAgo <= 60 * 24 * 7) return "week";
  return null;
}

export default function SitterMini({ sitter }: { sitter: Profile }) {
  const { t } = useLanguage();
  const activityBucket = getActivityBucket(sitter.last_active_at);
  return (
    <Link href={`/browse/${sitter.id}`} className="group flex items-center gap-3 bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-3.5 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:-translate-y-px active:shadow-[var(--shadow-sm)]">
      <Avatar name={sitter.full_name} url={sitter.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink truncate">{sitter.full_name}</div>
        <div className="flex items-center gap-1 text-xs text-ink-soft mt-0.5"><MapPin className="w-3 h-3" />{sitter.city}</div>
        {activityBucket && (
          <div className="flex items-center gap-1 text-[10px] text-ink-soft mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_DOT_CLASS[activityBucket]}`} />
            {t(`sitters.activity.${activityBucket}`)}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-semibold text-ink">€{sitter.rate_per_hour}</div>
        <div className="text-[10px] text-ink-soft">{t("appShell.sitterMini.rateSuffix")}</div>
      </div>
    </Link>
  );
}
