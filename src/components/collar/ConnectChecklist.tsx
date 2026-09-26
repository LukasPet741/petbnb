"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { useCollarLive } from "@/context/CollarLiveContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatClock } from "@/lib/collar/stats";
import { CHECKIN_TIMEOUT_MS, isOnline, pairedAt } from "@/lib/collar/status";
import { cn } from "@/lib/utils";
import { collarName } from "./names";

type ItemStatus = "done" | "active" | "warn" | "wait";

function Item({ status, title, detail, children }: { status: ItemStatus; title: string; detail?: string; children?: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border-2",
          status === "done" && "border-brand bg-brand text-white",
          status === "active" && "animate-spin border-brand-soft border-t-brand",
          status === "warn" && "border-amber bg-amber-soft text-amber-strong",
          status === "wait" && "border-ink/15",
        )}
      >
        {status === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
        {status === "warn" && <TriangleAlert className="h-3 w-3" strokeWidth={2.6} />}
      </span>
      <div className="min-w-0">
        <b className={cn("block text-[13.5px] leading-snug", status === "wait" ? "font-medium text-ink-soft" : "font-semibold text-ink")}>{title}</b>
        {detail && <small className="block text-xs text-ink-soft">{detail}</small>}
        {children}
      </div>
    </li>
  );
}

/**
 * Step 4 of pairing: the collar reporting in, live. It ticks itself off from the same provider
 * data the page uses, and after 90 s without a check-in it says what to check.
 */
export default function ConnectChecklist({ onDone, onPlay }: { onDone: () => void; onPlay: () => void }) {
  const { t, locale } = useLanguage();
  const { selected: device, state, now } = useCollarLive();
  const [waitFrom, setWaitFrom] = useState<number | null>(null);
  const live = state === "live";

  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(onDone, 1200);
    return () => clearTimeout(timer);
  }, [live, onDone]);

  if (!device) return null;
  const online = isOnline(device, now);
  const since = now - (waitFrom ?? Date.parse(pairedAt(device)));
  const slow = !online && !live && since > CHECKIN_TIMEOUT_MS;
  const sats = device.gps_satellites ?? 0;

  return (
    <div>
      <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
        {slow ? t("appPages.collar.wizard.connect.slowTitle") : t("appPages.collar.wizard.connect.title", { name: collarName(device, t) })}
      </h2>
      <ul className="my-3.5 space-y-2.5">
        <Item status="done" title={t("appPages.collar.wizard.connect.paired")} detail={formatClock(pairedAt(device), locale)} />
        <Item
          status={online || live ? "done" : slow ? "warn" : "active"}
          title={online || live ? t("appPages.collar.wizard.connect.online") : t("appPages.collar.wizard.connect.onlineWaiting")}
          detail={
            online && device.last_seen_at
              ? t("appPages.collar.wizard.connect.onlineDone", { time: formatClock(device.last_seen_at, locale) })
              : slow
                ? t("appPages.collar.wizard.connect.slowSeconds", { seconds: Math.floor(since / 1000) })
                : undefined
          }
        />
        <Item
          status={live ? "done" : online ? "active" : "wait"}
          title={t("appPages.collar.wizard.connect.satellites")}
          detail={online && !live ? t("appPages.collar.wizard.connect.satellitesCount", { count: sats }) : undefined}
        >
          {online && !live && (
            <div className="mt-1.5 flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1.5 w-[18px] rounded-full", i < sats ? "bg-brand" : "bg-surface-2")} />
              ))}
            </div>
          )}
        </Item>
        <Item status={live ? "done" : "wait"} title={t("appPages.collar.wizard.connect.first")} />
      </ul>

      {live ? (
        <p className="text-sm font-medium text-brand">{t("appPages.collar.wizard.connect.done")}</p>
      ) : slow ? (
        <>
          <ul className="mb-3 space-y-1.5 text-[12.5px] text-ink">
            {(["tipLight", "tipWifi", "tipBoot"] as const).map((tip) => (
              <li key={tip} className="flex gap-2 before:mt-[7px] before:h-1.5 before:w-1.5 before:flex-shrink-0 before:rounded-full before:bg-ink-soft">
                {t(`appPages.collar.wizard.connect.${tip}`)}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={() => setWaitFrom(now)} className="h-11 flex-1 rounded-xl border border-ink/10 bg-surface text-[13px] font-semibold text-ink">
              {t("appPages.collar.wizard.connect.keepWaiting")}
            </button>
            <button type="button" onClick={onPlay} className="h-11 flex-1 rounded-xl bg-brand text-[13px] font-semibold text-white">
              {t("appPages.collar.wizard.connect.recordedWalk")}
            </button>
          </div>
        </>
      ) : (
        <p className="border-t border-ink/8 pt-3 text-xs leading-relaxed text-ink-soft">
          {t("appPages.collar.wizard.connect.indoors")}{" "}
          <button type="button" onClick={onPlay} className="font-semibold text-brand">
            {t("appPages.collar.wizard.connect.playInstead")}
          </button>
        </p>
      )}
    </div>
  );
}
