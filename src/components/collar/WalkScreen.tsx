"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Square } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatClock, formatDayMonth } from "@/lib/collar/stats";
import {
  loadWalk, stopWalk, walkLiveState, walkStats, WALK_POLL_MS, type WalkDetail,
} from "@/lib/collar/walks";
import Button from "@/components/ui/Button";
import MoonLoader from "@/components/ui/MoonLoader";
import { cn } from "@/lib/utils";
import LazyCollarMap from "./LazyCollarMap";
import LiveDot from "./LiveDot";
import { useWalkReplay } from "./useWalkReplay";

const VILNIUS = { lat: 54.6872, lng: 25.2797 };
const CLOCK_MS = 1000;

/**
 * /walks/[walkId] (spec 2026-10-22-collar-walks-design): one screen for a walk, for the sitter who
 * walks and the owner who watches. Live while it runs (asked again every WALK_POLL_MS, since a
 * sitter cannot subscribe to the owner's collar), the saved route with Replay once it ended.
 */
export default function WalkScreen({ walkId }: { walkId: string }) {
  const { t, locale } = useLanguage();
  // undefined: still loading; null: gone or not the viewer's.
  const [detail, setDetail] = useState<WalkDetail | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = !!detail && !detail.walk.ended_at;
  const replay = useWalkReplay(detail?.walk.ended_at ? detail.walk.points : []);

  const load = useCallback(async () => {
    try {
      setDetail(await loadWalk(walkId));
      setFailed(false);
      setNow(Date.now());
    } catch {
      // Keep what is on screen; the next poll tries again.
      setFailed(true);
    }
  }, [walkId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!running || dropped) return;
    const poll = setInterval(() => void load(), WALK_POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [running, dropped, load]);

  const stop = async () => {
    setStopping(true);
    try {
      if ((await stopWalk(walkId)) === "dropped") setDropped(true);
      else await load();
    } catch {
      setFailed(true);
    } finally {
      setStopping(false);
    }
  };

  const back = (
    <Link href={detail?.is_owner ? "/collar" : "/bookings"}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t("appPages.collar.walks.back")}
    </Link>
  );

  if (detail === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
        {failed ? (
          <>
            <p className="text-sm text-ink">{t("appPages.collar.walks.failed")}</p>
            <Button className="mt-3" variant="secondary" onClick={() => void load()}>{t("appPages.collar.replay.tryAgain")}</Button>
          </>
        ) : (
          <div className="flex min-h-[50vh] items-center justify-center">
            <MoonLoader size={44} label={t("appPages.collar.walks.loading")} />
          </div>
        )}
      </div>
    );
  }

  if (detail === null || dropped) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
        {back}
        <p className="glass-card rounded-2xl border px-4 py-3 text-sm text-ink">
          {t(dropped ? "appPages.collar.walks.dropped" : "appPages.collar.walks.notFound")}
        </p>
      </div>
    );
  }

  const { walk } = detail;
  const stats = walkStats(walk, now);
  const state = walkLiveState(detail, now);
  const shownPoints = replay.index === null ? walk.points : walk.points.slice(0, replay.index + 1);
  const dot = shownPoints[shownPoints.length - 1] ?? null;
  const center = dot ?? VILNIUS;
  const who = walk.walked_by_me ? t("appPages.collar.walks.you") : walk.walker_name?.trim() || t("appPages.collar.walks.someone");
  const ended = walk.ended_at
    ? t("appPages.collar.walks.savedTitle", { date: `${formatDayMonth(walk.started_at, locale)} ${formatClock(walk.started_at, locale)}` })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      {back}
      <h1 className="font-display text-2xl font-bold text-ink">
        {detail.pet_name ? t("appPages.collar.walks.titlePet", { pet: detail.pet_name }) : t("appPages.collar.walks.title")}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {ended && <span className="font-medium text-ink">{ended}</span>}
        {ended && " · "}
        <span>{who}</span>
      </p>

      {state !== "ended" && (
        <p className={cn("mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
          state === "live" ? "border-brand/20 bg-brand-softer text-brand-strong" : "border-ink/10 bg-surface text-ink-soft")}>
          {state === "live" && <LiveDot />}
          {t(`appPages.collar.walks.${state}`)}
        </p>
      )}
      {walk.end_reason === "time_limit" && <p className="mt-2 text-xs text-ink-soft">{t("appPages.collar.walks.endedTimeLimit")}</p>}
      {walk.end_reason === "no_signal" && <p className="mt-2 text-xs text-ink-soft">{t("appPages.collar.walks.endedNoSignal")}</p>}

      <div className="relative isolate mt-4 h-[52vh] min-h-[280px] overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-md)]">
        <LazyCollarMap
          lat={center.lat}
          lng={center.lng}
          path={shownPoints}
          showMarker={!!dot}
          stale={state === "offline" || (state === "ended" && replay.index === null)}
          fitKey={`${walk.id}:${state === "ended" ? "saved" : "live"}`}
          controls={{ zoomIn: t("appPages.collar.zoomIn"), zoomOut: t("appPages.collar.zoomOut"), locate: t("appPages.collar.locate") }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="glass-card rounded-2xl border px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.walks.elapsed")}</p>
          <b className="text-lg font-semibold tabular-nums">{`${Math.round(stats.durationMin)} min`}</b>
        </div>
        <div className="glass-card rounded-2xl border px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.walks.distance")}</p>
          <b className="text-lg font-semibold tabular-nums">{`${stats.distanceKm.toFixed(2)} km`}</b>
        </div>
      </div>

      {failed && <p className="mt-3 text-xs font-medium text-amber-strong">{t("appPages.collar.walks.failed")}</p>}

      <div className="mt-4 flex flex-wrap gap-2.5">
        {running && detail.can_stop && (
          <Button variant="danger-soft" onClick={() => void stop()} loading={stopping} disabled={stopping}>
            <Square className="h-4 w-4" aria-hidden="true" />
            {t(stopping ? "appPages.collar.walks.stopping" : "appPages.collar.walks.stop")}
          </Button>
        )}
        {!running && walk.points.length > 1 && (
          replay.index === null ? (
            <Button onClick={replay.play}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {t("appPages.collar.walks.replay")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={replay.stop}>{t("appPages.collar.walks.stopReplay")}</Button>
          )
        )}
      </div>
    </div>
  );
}
