"use client";
import { Play } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { ReplayError } from "@/context/CollarLiveContext";
import CollarArt from "./CollarArt";

/** The page before anything is paired: pair the real collar, or watch a recorded walk. */
export default function CollarEmpty({ onPair, onPlay, replayError }: { onPair: () => void; onPlay: () => void; replayError: ReplayError | null }) {
  const { t } = useLanguage();
  return (
    <section className="glass-card mx-auto mt-4 max-w-md rounded-2xl border p-6 text-center sm:mt-10 sm:p-8">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.pageLabel")}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">{t("appPages.collar.empty.title")}</h1>
      <CollarArt className="mx-auto my-4 h-[104px] w-full max-w-[300px] rounded-2xl bg-gradient-to-br from-brand-softer to-white" />
      <p className="mx-auto max-w-xs text-sm text-ink-soft">{t("appPages.collar.empty.text")}</p>
      <div className="mt-5 grid gap-2">
        <button type="button" onClick={onPair} className="h-11 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-strong">
          {t("appPages.collar.empty.pair")}
        </button>
        {/* Once the database says there is no recording, offering it again would only fail again. */}
        {replayError !== "no_recording" && (
          <button type="button" onClick={onPlay} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-ink/10 bg-surface/80 text-sm font-semibold text-ink hover:bg-surface">
            <Play className="h-4 w-4" aria-hidden="true" />
            {t("appPages.collar.play")}
          </button>
        )}
      </div>
      {replayError && (
        <p role="alert" className="mt-3 text-sm text-amber-strong">
          {t(replayError === "no_recording" ? "appPages.collar.replay.noRecording" : "appPages.collar.replay.stopped")}
        </p>
      )}
    </section>
  );
}
