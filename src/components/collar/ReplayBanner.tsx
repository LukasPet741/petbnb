"use client";
import { Play, Square } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { ReplayProgress } from "@/context/CollarLiveContext";

/** Always says it is a recording: the committee must never mistake the replay for the live Pi. */
export default function ReplayBanner({ replay, onStop }: { replay: ReplayProgress | null; onStop: () => void }) {
  const { t } = useLanguage();
  const known = replay && replay.total > 0;
  return (
    <>
      <div className="glass-panel absolute inset-x-3 top-3 z-[800] rounded-[14px] border px-3.5 py-2.5 sm:left-4 sm:right-auto sm:w-[380px]">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Play className="h-3.5 w-3.5 text-amber-strong" aria-hidden="true" />
          {t("appPages.collar.replay.title")}
          <span className="ml-auto rounded-md bg-amber-soft px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-amber-strong">DEMO</span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-soft">
          {t("appPages.collar.replay.note")}
          {known && <> · {t("appPages.collar.replay.progress", { done: replay.idx, total: replay.total })}</>}
        </p>
        <div
          role="progressbar"
          aria-label={t("appPages.collar.replay.title")}
          aria-valuemin={0}
          aria-valuemax={known ? replay.total : 0}
          aria-valuenow={known ? replay.idx : 0}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-amber transition-[width] duration-500" style={{ width: known ? `${(replay.idx / replay.total) * 100}%` : "0%" }} />
        </div>
      </div>
      {/* bottom-6, not bottom-3: the OpenStreetMap credit sits in the bottom-right corner. */}
      <button type="button" onClick={onStop}
        className="glass-panel absolute bottom-6 right-3 z-[800] flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold text-ink">
        <Square className="h-3.5 w-3.5" aria-hidden="true" />
        {t("appPages.collar.stop")}
      </button>
    </>
  );
}
