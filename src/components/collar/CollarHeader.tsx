"use client";
import { useEffect, useRef, useState } from "react";
import { Ellipsis, Play, Square } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatDayMonth } from "@/lib/collar/stats";
import { pairedAt } from "@/lib/collar/status";
import type { CollarDevice, CollarState } from "@/lib/collar/types";
import { cn } from "@/lib/utils";
import LiveDot from "./LiveDot";
import { collarName } from "./names";

const PILL: Record<Exclude<CollarState, "no_collar">, string> = {
  live: "bg-amber-soft text-amber-strong",
  replaying: "bg-amber-soft text-amber-strong",
  demo_idle: "bg-amber-soft text-amber-strong",
  searching: "bg-slate-soft text-slate",
  waiting: "bg-surface-2 text-ink-soft",
  offline: "bg-surface-2 text-ink-soft",
};

export default function CollarHeader({
  device, state, canPlay = true, onPlay, onStop, onRename, onRemove, onPairAnother,
}: {
  device: CollarDevice;
  state: Exclude<CollarState, "no_collar">;
  /** False once the database said there is no recording to play. */
  canPlay?: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRename: () => void;
  onRemove: () => void;
  onPairAnother: () => void;
}) {
  const { t, locale } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const choose = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.pageLabel")}</p>
        <div className="mt-0.5 flex items-center gap-3">
          <h1 className="truncate font-display text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">{collarName(device, t)}</h1>
          <span className={cn("inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-bold tracking-[0.07em]", PILL[state])}>
            {(state === "live" || state === "replaying") && <LiveDot />}
            {t(`appPages.collar.states.${state}`)}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-ink-soft">
          {device.is_demo ? t("appPages.collar.demoHardware") : t("appPages.collar.hardware", { date: formatDayMonth(pairedAt(device), locale) })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {state === "replaying" ? (
          <button type="button" onClick={onStop} className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink/10 bg-surface/85 px-4 text-sm font-semibold text-ink">
            <Square className="h-4 w-4" aria-hidden="true" />
            {t("appPages.collar.stop")}
          </button>
        ) : canPlay ? (
          <button type="button" onClick={onPlay} className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink/10 bg-surface/85 px-4 text-sm font-semibold text-ink">
            <Play className="h-4 w-4" aria-hidden="true" />
            {t("appPages.collar.play")}
          </button>
        ) : null}
        <div ref={menuRef} className="relative">
          <button type="button" aria-label={t("appPages.collar.more")} aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-surface/85 text-ink">
            <Ellipsis className="h-4 w-4" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-11 z-20 w-56 rounded-xl border border-ink/8 bg-surface p-1 shadow-[var(--shadow-lg)]">
              {!device.is_demo && (
                <button type="button" role="menuitem" onClick={choose(onRename)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-brand-softer">
                  {t("appPages.collar.rename")}
                </button>
              )}
              <button type="button" role="menuitem" onClick={choose(onPairAnother)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-brand-softer">
                {t("appPages.collar.pairAnother")}
              </button>
              <button type="button" role="menuitem" onClick={choose(onRemove)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft">
                {t("appPages.collar.remove")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
