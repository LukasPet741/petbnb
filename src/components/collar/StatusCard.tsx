"use client";
import { Satellite, Wifi } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { activityOf } from "@/lib/collar/stats";
import { timeAgo } from "@/lib/utils";
import type { CollarDevice, CollarPosition } from "@/lib/collar/types";
import LiveDot from "./LiveDot";

/** The glass card floating on the live map: speed first, then what the dog is doing and where. */
export default function StatusCard({ device, latest, place }: { device: CollarDevice; latest: CollarPosition; place: string | null }) {
  const { t } = useLanguage();
  const speed = latest.speed_kmh;
  const activity = speed == null ? null : activityOf(speed);

  return (
    <div className="glass-panel absolute left-4 top-4 z-[800] hidden w-60 rounded-[14px] border px-4 pb-3.5 pt-3 sm:block">
      <div className="flex items-center gap-2 text-xs">
        <LiveDot />
        <b className="tracking-[0.08em] text-ink">{t("appPages.collar.states.live")}</b>
        <span className="text-ink-soft">· {t("appPages.collar.updatedAgo", { ago: timeAgo(latest.recorded_at, t, "appPages.collar.ago") })}</span>
      </div>
      <div className="mt-2 font-display text-[34px] font-semibold leading-none tracking-tight text-ink">
        {speed == null ? "–" : speed.toFixed(1)}
        <small className="ml-1 text-[15px] font-medium tracking-normal text-ink-soft">{t("appPages.collar.speedUnit")}</small>
      </div>
      <div className="mt-1 text-[13px] text-ink-soft">
        {activity ? t(`appPages.collar.activity.${activity}`) : ""}
        {place ? `${activity ? " · " : ""}${place}` : ""}
      </div>
      <div className="mt-3 space-y-1 border-t border-ink/8 pt-2.5 text-xs text-ink-soft">
        {device.gps_satellites != null && (
          <div className="flex items-center gap-2">
            <Satellite className="h-3.5 w-3.5 text-slate" aria-hidden="true" />
            {t("appPages.collar.satellitesLocked", { count: device.gps_satellites })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Wifi className="h-3.5 w-3.5 text-slate" aria-hidden="true" />
          {t("appPages.collar.onWifi")}
        </div>
      </div>
    </div>
  );
}
