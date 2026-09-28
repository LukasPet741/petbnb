"use client";
import { Clock, Play, WifiOff } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { ReplayError, ReplayProgress } from "@/context/CollarLiveContext";
import { formatClock, routeStats } from "@/lib/collar/stats";
import type { CollarDevice, CollarPosition, CollarState } from "@/lib/collar/types";
import { cn, timeAgo } from "@/lib/utils";
import LazyCollarMap from "./LazyCollarMap";
import ReplayBanner from "./ReplayBanner";
import StateCard from "./StateCard";
import StatusCard from "./StatusCard";
import LiveDot from "./LiveDot";
import { usePlaceName } from "./usePlaceName";

const VILNIUS = { lat: 54.6872, lng: 25.2797 };

interface HeroProps {
  state: CollarState;
  device: CollarDevice;
  latest: CollarPosition | null;
  trail: CollarPosition[];
  fitKey: string;
  now: number;
  replay: ReplayProgress | null;
  replayError: ReplayError | null;
  onPlay: () => void;
  onStop: () => void;
}

function PlayButton({ onPlay, label }: { onPlay: () => void; label: string }) {
  return (
    <button type="button" onClick={onPlay}
      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-strong">
      <Play className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

/** The live map with whatever floats on it for the collar's current state (spec "Status rule"). */
export default function CollarHero({ state, device, latest, trail, fitKey, now, replay, replayError, onPlay, onStop }: HeroProps) {
  const { t, locale } = useLanguage();
  const place = usePlaceName(state === "live" ? latest : null);
  const center = latest ?? VILNIUS;
  const muted = state === "searching" || state === "waiting";
  const today = state === "live" ? routeStats(trail) : null;
  const minutesSilent = device.last_seen_at ? Math.max(1, Math.floor((now - Date.parse(device.last_seen_at)) / 60_000)) : 0;
  const sats = device.gps_satellites ?? 0;
  // No recording: the state card keeps saying what the collar is doing and says so where Play
  // was — it used to replace the card until a reload (review M14). A walk that stopped still
  // takes the card over, with Try again; live has no card of its own, so it gets one.
  const noRecording = replayError === "no_recording";
  const play = noRecording
    ? <p className="mt-3 text-[12.5px] font-medium text-ink">{t("appPages.collar.replay.noRecording")}</p>
    : <PlayButton onPlay={onPlay} label={t("appPages.collar.play")} />;

  return (
    <>
      {/* isolate: Leaflet's panes (z 200–1000) and the z-800 cards stay inside this box, so the
          pairing wizard and the rename/remove dialogs (z-50) open above the map, not under it. */}
      <div className="relative isolate h-[330px] overflow-hidden rounded-[20px] shadow-[var(--shadow-md)] sm:h-[420px] lg:h-[486px]">
        <div className={cn("h-full w-full", muted && "grayscale-[60%] opacity-80")}>
          <LazyCollarMap
            lat={center.lat}
            lng={center.lng}
            path={trail.slice(0, -1)}
            showMarker={!!latest && state !== "waiting" && state !== "searching"}
            stale={state === "offline" || state === "demo_idle"}
            fitKey={fitKey}
            controls={{ zoomIn: t("appPages.collar.zoomIn"), zoomOut: t("appPages.collar.zoomOut"), locate: t("appPages.collar.locate") }}
          />
        </div>

        {state === "live" && latest && <StatusCard device={device} latest={latest} place={place} />}
        {state === "live" && latest && (
          // bottom-6, not bottom-3: the OpenStreetMap credit sits in the bottom-right corner.
          <div className="glass-panel absolute bottom-6 left-3 z-[800] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-medium sm:hidden">
            <LiveDot />
            <span className="truncate">
              {t("appPages.collar.updatedAgo", { ago: timeAgo(latest.recorded_at, t, "appPages.collar.ago") })}
              {place ? ` · ${place}` : ""}
            </span>
          </div>
        )}
        {state === "live" && today && (
          <div className="glass-panel absolute bottom-4 left-4 z-[800] hidden items-center gap-3.5 rounded-xl border px-3.5 py-2 text-[13px] sm:flex">
            <span>{t("appPages.collar.today")}</span>
            <b>{t("appPages.collar.todaySummary", { km: today.distanceKm.toFixed(1), min: Math.round(today.durationMin) })}</b>
          </div>
        )}

        {state === "replaying" && <ReplayBanner replay={replay} onStop={onStop} />}

        {replayError === "stopped" || (noRecording && state === "live") ? (
          <StateCard title={t(noRecording ? "appPages.collar.replay.noRecording" : "appPages.collar.replay.stopped")}>
            {replayError === "stopped" && (
              <button type="button" onClick={onPlay} className="mt-3 inline-flex h-10 items-center rounded-xl border border-ink/10 bg-surface px-4 text-[13px] font-semibold text-ink">
                {t("appPages.collar.replay.tryAgain")}
              </button>
            )}
          </StateCard>
        ) : state === "searching" ? (
          <StateCard icon={<LiveDot className="[&>span]:bg-slate" />} title={t("appPages.collar.searching.title")}>
            <div className="mt-2 flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1.5 w-5 rounded-full", i < sats ? "bg-brand" : "bg-surface-2")} />
              ))}
              <span className="ml-1.5 text-[11.5px] text-ink-soft">{/* 4+ in view without a fix: the signal is short, not the count (review M4). */}
                {t(sats >= 4 ? "appPages.collar.searching.countWeak" : "appPages.collar.searching.count", { count: sats })}</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{t("appPages.collar.searching.text")}</p>
            {play}
          </StateCard>
        ) : state === "waiting" ? (
          <StateCard icon={<Clock className="h-4 w-4 text-ink-soft" aria-hidden="true" />} title={t("appPages.collar.waiting.title")}>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{t("appPages.collar.waiting.text")}</p>
            {play}
          </StateCard>
        ) : state === "offline" ? (
          <StateCard icon={<WifiOff className="h-4 w-4 text-ink-soft" aria-hidden="true" />} title={t("appPages.collar.offline.title", { minutes: minutesSilent })}>
            <p className="mt-1 text-[12px] font-medium text-ink">
              {t("appPages.collar.offline.lastSeen", { time: device.last_seen_at ? formatClock(device.last_seen_at, locale) : "–" })}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{t("appPages.collar.offline.text")}</p>
            {play}
          </StateCard>
        ) : state === "demo_idle" ? (
          <StateCard title={t("appPages.collar.demoIdle.title")}>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{t("appPages.collar.demoIdle.text")}</p>
            {play}
          </StateCard>
        ) : null}
      </div>

      {state === "live" && latest && (
        <div className="mt-2.5 grid grid-cols-3 gap-2 sm:hidden">
          <div className="glass-card rounded-2xl border px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.speed")}</p>
            <b className="text-lg font-semibold">{latest.speed_kmh == null ? "–" : latest.speed_kmh.toFixed(1)}</b>
          </div>
          <div className="glass-card rounded-2xl border px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.today")}</p>
            <b className="text-lg font-semibold">{today ? today.distanceKm.toFixed(1) : "0.0"}</b>
          </div>
          <div className="glass-card rounded-2xl border px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.satellites")}</p>
            <b className="text-lg font-semibold">{device.gps_satellites ?? "–"}</b>
          </div>
        </div>
      )}
    </>
  );
}
