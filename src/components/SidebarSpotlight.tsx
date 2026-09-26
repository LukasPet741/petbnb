"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronRight, Radar, ShieldCheck } from "lucide-react";
import { useCollarLive } from "@/context/CollarLiveContext";
import { shownPosition } from "@/lib/collar/status";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/context/LanguageContext";
import { cn, timeAgo } from "@/lib/utils";
import { formatClock } from "@/lib/collar/stats";
import MiniMap from "@/components/collar/MiniMap";
import LiveDot from "@/components/collar/LiveDot";
import { collarName } from "@/components/collar/names";

/**
 * Sidebar option A (Lukas, 2026-09-26): the collar and Smart-ID at the top of the menu on every
 * page — the two things the thesis defence is about. Shared by the desktop rail and the phone drawer.
 */
export default function SidebarSpotlight({ onNavigate }: { onNavigate?: () => void }) {
  const { t, locale } = useLanguage();
  const pathname = usePathname();
  const live = useCollarLive();
  const { selected, state } = live;
  // The replay's point only while it plays; otherwise the collar's own last fix (review I2).
  const latest = shownPosition(state, selected, live.latest, live.latestReal);
  const { profile } = useProfile();
  const verified = !!profile?.is_verified;
  const onCollar = pathname === "/collar";
  const onSmartId = pathname.startsWith("/smart-id-demo");

  const line = (() => {
    switch (state) {
      case "live":
        return t("appShell.spotlight.lineLive", {
          ago: latest ? timeAgo(latest.recorded_at, t, "appPages.collar.ago") : "",
          speed: (latest?.speed_kmh ?? 0).toFixed(1),
        });
      case "replaying":
        return t("appShell.spotlight.lineReplaying");
      case "searching":
        return t("appShell.spotlight.lineSearching");
      case "waiting":
        return t("appShell.spotlight.lineWaiting");
      case "offline":
        return t("appShell.spotlight.lineOffline", {
          time: selected?.last_seen_at ? formatClock(selected.last_seen_at, locale) : "–",
        });
      case "demo_idle":
        return t("appShell.spotlight.lineDemoIdle");
      default:
        return t("appShell.spotlight.pairText");
    }
  })();

  return (
    <div className="mb-4 space-y-2">
      <Link
        href="/collar"
        onClick={onNavigate}
        aria-current={onCollar ? "page" : undefined}
        className={cn(
          "glass-card block overflow-hidden rounded-2xl border transition-shadow hover:shadow-[var(--shadow-md)]",
          onCollar && "ring-2 ring-brand",
        )}
      >
        {selected && latest && (
          <div className="relative">
            <MiniMap lat={latest.lat} lng={latest.lng} height={56} muted={state !== "live" && state !== "replaying"} />
            {(state === "live" || state === "replaying") && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-px text-[9.5px] font-bold tracking-[0.08em] text-ink shadow-sm">
                <LiveDot className="h-1.5 w-1.5" />
                {state === "replaying" ? t("appShell.spotlight.demo") : t("appShell.spotlight.live")}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2.5 px-3 py-2">
          {!selected && (
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] bg-slate text-white">
              <Radar className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-ink">
              {selected ? (
                <>
                  {collarName(selected, t)}
                  <span className="font-medium text-ink-soft"> · {t("appShell.spotlight.collarTitle")}</span>
                </>
              ) : (
                t("appShell.spotlight.pairTitle")
              )}
            </div>
            <div className="truncate text-[11.5px] text-ink-soft">{line}</div>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-soft/70" aria-hidden="true" />
        </div>
      </Link>

      <Link
        href="/smart-id-demo"
        onClick={onNavigate}
        aria-current={onSmartId ? "page" : undefined}
        className={cn(
          "glass-card flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 transition-shadow hover:shadow-[var(--shadow-md)]",
          onSmartId && "ring-2 ring-brand",
        )}
      >
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#2a7a5e] to-brand-strong text-white">
          <ShieldCheck className="h-[17px] w-[17px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink">{t("appShell.spotlight.smartIdTitle")}</div>
          <div className={cn("flex min-w-0 items-center gap-1 text-[11.5px] font-medium", verified ? "text-brand" : "text-amber-strong")}>
            {verified && <Check className="h-3 w-3 flex-shrink-0" strokeWidth={2.6} aria-hidden="true" />}
            {/* Its own span: text-overflow works on a block, not on the flex line around it. */}
            <span className="truncate">
              {verified ? t("appShell.spotlight.smartIdVerified") : t("appShell.spotlight.smartIdTodo")}
            </span>
          </div>
        </div>
        {verified ? (
          <span className="rounded-md bg-amber-soft px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-amber-strong">
            {t("appShell.spotlight.demo")}
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-soft/70" aria-hidden="true" />
        )}
      </Link>
    </div>
  );
}
