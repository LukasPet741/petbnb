"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useCollarLive } from "@/context/CollarLiveContext";
import { shownPosition } from "@/lib/collar/status";
import { cn } from "@/lib/utils";
import CollarEmpty from "./CollarEmpty";
import CollarHeader from "./CollarHeader";
import CollarHero from "./CollarHero";
import PairingWizard from "./PairingWizard";
import WeekCard from "./WeekCard";
import { RemoveDialog, RenameDialog } from "./CollarDialogs";
import { collarName } from "./names";
import { useCollarTrail } from "./useCollarTrail";

/** /collar (spec "Web — collar"): the live collar, how it connects, and every way it can fail. */
export default function CollarPage() {
  const { t } = useLanguage();
  const live = useCollarLive();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const selectedId = live.selected?.id ?? null;
  // The replay's point only while it plays; otherwise the collar's own last fix (review I2).
  const shown = shownPosition(live.state, live.selected, live.latest, live.latestReal);
  const pageTrail = useCollarTrail(selectedId, shown, day, live.state === "replaying");
  // This tab's walk: the provider kept every point, so opening the page mid-walk draws it all
  // (review M10). The hook's own replay trail is for a walk played in another tab.
  const trail = live.replay && live.replay.deviceId === selectedId && !day && live.replayTrail.length > 0
    ? live.replayTrail
    : pageTrail;

  useEffect(() => {
    setDay(null);
  }, [selectedId]);

  if (live.loading) {
    return (
      <div role="status" aria-label={t("appPages.collar.loading")} className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const device = live.selected;
  const wizard = wizardOpen && <PairingWizard onClose={() => setWizardOpen(false)} />;

  if (!device || live.state === "no_collar") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <CollarEmpty onPair={() => setWizardOpen(true)} onPlay={() => void live.startReplay()} replayError={live.replayError} />
        {wizard}
      </div>
    );
  }

  const state = live.state;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <CollarHeader
        device={device}
        state={state}
        canPlay={live.replayError !== "no_recording"}
        onPlay={() => void live.startReplay()}
        onStop={live.stopReplay}
        onRename={() => setRenaming(true)}
        onRemove={() => setRemoving(true)}
        onPairAnother={() => setWizardOpen(true)}
      />

      {live.collars.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t("appPages.collar.collars")}>
          {live.collars.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === device.id} onClick={() => live.select(c.id)}
              className={cn("h-9 rounded-full border px-3.5 text-sm font-medium", c.id === device.id ? "border-brand bg-brand-softer text-brand-strong" : "border-ink/10 bg-surface/80 text-ink-soft")}>
              {collarName(c, t)}
            </button>
          ))}
        </div>
      )}

      <CollarHero
        state={state}
        device={device}
        latest={day ? trail[trail.length - 1] ?? null : shown}
        trail={trail}
        fitKey={`${device.id}:${day ?? (state === "replaying" ? "replay" : "today")}`}
        now={live.now}
        replay={live.replay}
        replayError={live.replayError}
        onPlay={() => void live.startReplay()}
        onStop={live.stopReplay}
      />

      {!device.is_demo && <WeekCard deviceId={device.id} selectedDay={day} onSelectDay={setDay} />}

      {renaming && (
        <RenameDialog initial={device.label ?? ""} onClose={() => setRenaming(false)}
          onSave={(label) => {
            setRenaming(false);
            void live.rename(device.id, label);
          }} />
      )}
      {removing && (
        <RemoveDialog name={collarName(device, t)} onClose={() => setRemoving(false)}
          onRemove={() => {
            setRemoving(false);
            void live.remove(device.id);
          }} />
      )}
      {wizard}
    </div>
  );
}
