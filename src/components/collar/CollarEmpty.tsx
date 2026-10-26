"use client";
import { Play, Radar } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { ReplayError } from "@/context/CollarLiveContext";
import CollarArt from "./CollarArt";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** A drawn walk on a drawn map: what the page will show once a collar is on. Decoration, no data. */
function WalkSketch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <rect width="400" height="260" fill="var(--map-bg)" />
      <path d="M-10 70 C80 40 150 120 240 80 S380 30 420 60 L420 130 C330 120 280 170 190 150 S40 140 -10 170Z" fill="var(--map-park)" opacity="0.85" />
      <ellipse cx="320" cy="205" rx="70" ry="34" fill="var(--map-park)" />
      <g stroke="var(--map-road)" strokeLinecap="round" fill="none">
        <path d="M-10 200 L420 176" strokeWidth="12" />
        <path d="M120 -10 L150 270" strokeWidth="9" />
        <path d="M290 -10 C270 80 300 160 260 270" strokeWidth="7" />
        <path d="M-10 110 L420 120" strokeWidth="5" />
      </g>
      <path
        d="M58 188 C90 160 104 140 136 128 S190 96 214 108 S262 150 286 132 S330 86 352 96"
        fill="none" stroke="var(--map-route)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="58" cy="188" r="6" fill="var(--surface)" stroke="var(--map-route)" strokeWidth="3" />
      <circle cx="352" cy="96" r="16" fill="var(--amber)" opacity="0.25" className="animate-pulse" />
      <circle cx="352" cy="96" r="7" fill="var(--amber)" stroke="var(--surface)" strokeWidth="3" />
    </svg>
  );
}

/** The page before anything is paired: pair the real collar, or watch a recorded walk. */
export default function CollarEmpty({ onPair, onPlay, replayError }: { onPair: () => void; onPlay: () => void; replayError: ReplayError | null }) {
  const { t } = useLanguage();
  return (
    <section className="pb-band grid items-center gap-8 overflow-hidden rounded-[var(--radius-hero)] border border-[var(--chrome-line)] p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
      <div className="min-w-0">
        <span aria-hidden="true" className="mb-5 grid h-10 w-10 place-items-center rounded-[var(--radius-control)] border border-[var(--chrome-line)] bg-[var(--chrome-active)] text-[var(--hero-accent)]">
          <Radar className="h-5 w-5" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-chrome-ink-soft">{t("appPages.collar.pageLabel")}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-chrome-ink sm:text-5xl sm:leading-[1.05]">{t("appPages.collar.empty.title")}</h1>
        <p className="mt-4 max-w-md text-base text-chrome-ink-soft">{t("appPages.collar.empty.text")}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={onPair} className={cn(buttonClasses({ variant: "accent", size: "lg" }), "w-full sm:w-auto")}>
            {t("appPages.collar.empty.pair")}
          </button>
          {/* Once the database says there is no recording, offering it again would only fail again. */}
          {replayError !== "no_recording" && (
            <button type="button" onClick={onPlay} className={cn(buttonClasses({ variant: "on-chrome", size: "lg" }), "w-full sm:w-auto")}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {t("appPages.collar.play")}
            </button>
          )}
        </div>
        {replayError && (
          <p role="alert" className="mt-4 inline-block rounded-[var(--radius-control)] bg-amber-soft px-3 py-2 text-sm text-amber-strong">
            {t(replayError === "no_recording" ? "appPages.collar.replay.noRecording" : "appPages.collar.replay.stopped")}
          </p>
        )}
      </div>

      {/* The framed picture: a walk on the map, the collar that draws it laid over its foot. */}
      <div className="relative min-w-0 pb-10 sm:pb-12">
        <div className="overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] ring-1 ring-[var(--chrome-line)]">
          <WalkSketch className="block aspect-[16/10] h-auto w-full" />
        </div>
        <div className="absolute inset-x-6 bottom-0 rounded-[var(--radius-card)] border border-ink/8 bg-surface p-3 shadow-[var(--shadow-md)] sm:inset-x-10">
          <CollarArt className="mx-auto h-[72px] w-full max-w-[260px] sm:h-[88px]" />
        </div>
      </div>
    </section>
  );
}
