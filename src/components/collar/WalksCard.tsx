"use client";
import Link from "next/link";
import { Footprints, Square } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatClock, formatDayMonth } from "@/lib/collar/stats";
import { walkStats, type CollarWalk } from "@/lib/collar/walks";
import Button, { ButtonLink } from "@/components/ui/Button";
import LiveDot from "./LiveDot";
import { useDeviceWalks } from "./useDeviceWalks";

/**
 * The owner's walks on /collar (spec 2026-10-22-collar-walks-design): Start, the walk in progress
 * (theirs or a sitter's) with Stop, and the last 3 saved walks. The live map above already follows
 * the collar, so a running walk needs no map of its own here.
 */
export default function WalksCard({ deviceId, now }: { deviceId: string; now: number }) {
  const { t, locale } = useLanguage();
  const { walks, error, dropped, busy, start, stop } = useDeviceWalks(deviceId);
  const running = walks?.running ?? null;
  const recent = walks?.recent ?? [];

  const who = (walk: CollarWalk) =>
    walk.walked_by_me ? t("appPages.collar.walks.you") : walk.walker_name?.trim() || t("appPages.collar.walks.someone");
  const summary = (walk: CollarWalk) => {
    const stats = walkStats(walk, now);
    return t("appPages.collar.walks.summary", { min: Math.round(stats.durationMin), km: stats.distanceKm.toFixed(1) });
  };

  return (
    <section className="glass-card mt-4 rounded-[var(--radius-card)] border p-4 sm:p-5" aria-labelledby="collar-walks-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="collar-walks-title" className="font-display text-lg font-bold text-ink">{t("appPages.collar.walks.recent")}</h2>
        {walks && !running && (
          <Button size="sm" onClick={() => void start()} loading={busy} disabled={busy}>
            <Footprints className="h-4 w-4" aria-hidden="true" />
            {t("appPages.collar.walks.start")}
          </Button>
        )}
      </div>

      {running && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-brand/20 bg-brand-softer px-3.5 py-3">
          <LiveDot />
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-sm font-semibold text-ink">{`${t("appPages.collar.walks.inProgress")} · ${who(running)}`}</p>
            <p className="text-xs text-ink-soft tabular-nums">{summary(running)}</p>
          </div>
          <ButtonLink size="sm" variant="ghost" href={`/walks/${running.id}`}>{t("appPages.collar.walks.open")}</ButtonLink>
          <Button size="sm" variant="danger-soft" onClick={() => void stop(running.id)} loading={busy} disabled={busy}>
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            {t("appPages.collar.walks.stop")}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs font-medium text-amber-strong">
          {t(error === "walk_running" ? "appPages.collar.walks.running" : error === "not_allowed" ? "appPages.collar.walks.notAllowed" : "appPages.collar.walks.failed")}
        </p>
      )}
      {dropped && <p className="mt-3 text-xs text-ink-soft">{t("appPages.collar.walks.dropped")}</p>}

      {walks && recent.length === 0 && !running && (
        <p className="mt-2 text-sm text-ink-soft">{t("appPages.collar.walks.none")}</p>
      )}
      {recent.length > 0 && (
        <ul className="mt-3 divide-y divide-ink/5">
          {recent.map((walk) => (
            <li key={walk.id}>
              <Link href={`/walks/${walk.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-brand-softer">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {`${formatDayMonth(walk.started_at, locale)}, ${formatClock(walk.started_at, locale)} · ${who(walk)}`}
                  </p>
                  <p className="text-xs text-ink-soft tabular-nums">{summary(walk)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
