"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { loadPositions } from "@/lib/collar/api";
import { dayBounds, lastSevenDates, summarizeWeek, todayInputValue, weekdayShort, type WeekSummary } from "@/lib/collar/stats";
import { cn } from "@/lib/utils";

/**
 * The last seven days of real positions (never replays). One request per day, as before: a week
 * of pings from an active collar can pass 20k rows, which one range query would silently truncate.
 */
export default function WeekCard({
  deviceId, selectedDay, onSelectDay,
}: {
  deviceId: string;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}) {
  const { t, locale } = useLanguage();
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const today = todayInputValue();

  useEffect(() => {
    let active = true;
    Promise.all(
      lastSevenDates().map(async (date) => {
        const { from, to } = dayBounds(date);
        return { date, points: await loadPositions(deviceId, from, to, "collar") };
      }),
    )
      .then((days) => {
        if (active) setSummary(summarizeWeek(days));
      })
      .catch(() => {
        if (active) setSummary(summarizeWeek([]));
      });
    return () => {
      active = false;
    };
  }, [deviceId]);

  const max = Math.max(0.1, ...(summary?.days.map((d) => d.distanceKm) ?? [0]));
  const shown = selectedDay ?? today;
  const mix = summary?.activity;

  return (
    <div className="mt-3.5 grid gap-3.5 sm:grid-cols-[2fr_1fr]">
      <section className="glass-card rounded-2xl border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.week.title")}</h2>
          {selectedDay ? (
            <button type="button" onClick={() => onSelectDay(null)} className="text-xs font-semibold text-brand">
              {t("appPages.collar.week.backToToday")}
            </button>
          ) : (
            <span className="text-xs text-ink-soft">{t("appPages.collar.week.hint")}</span>
          )}
        </div>
        {summary && summary.totalDistanceKm > 0 ? (
          <div className="mt-2 flex items-end gap-5">
            <div className="font-display text-3xl font-semibold leading-none tracking-tight">
              {summary.totalDistanceKm.toFixed(1)}
              <small className="ml-1 text-sm font-medium tracking-normal text-ink-soft">km</small>
            </div>
            <div className="grid h-16 flex-1 grid-cols-7 items-end gap-2">
              {summary.days.map((day) => {
                const active = day.date === shown;
                return (
                  <button
                    key={day.date}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${weekdayShort(day.date, locale)} ${day.distanceKm.toFixed(1)} km`}
                    onClick={() => onSelectDay(day.date === today ? null : day.date)}
                    className="flex h-full flex-col items-center justify-end gap-1"
                  >
                    <span
                      className={cn("w-full max-w-[30px] rounded-b-sm rounded-t-md", active ? "bg-brand" : "bg-slate-soft")}
                      style={{ height: `${Math.max(8, (day.distanceKm / max) * 100)}%` }}
                    />
                    <span className={cn("text-[10.5px] leading-none", active ? "font-bold text-brand" : "text-ink-soft")}>
                      {weekdayShort(day.date, locale).slice(0, 2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : summary ? (
          <p className="mt-3 text-sm text-ink-soft">{t("appPages.collar.week.empty")}</p>
        ) : null}
      </section>

      <section className="glass-card rounded-2xl border p-4">
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.week.activity")}</h2>
        {mix ? (
          <>
            <div className="mt-3.5 flex h-2 overflow-hidden rounded-full bg-surface-2">
              <i className="block h-full bg-[#c9d6db]" style={{ width: `${mix.restingPct}%` }} />
              <i className="block h-full bg-[#9cc4b0]" style={{ width: `${mix.walkingPct}%` }} />
              <i className="block h-full bg-[#e9c07e]" style={{ width: `${mix.runningPct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11.5px] text-ink-soft">
              <span>{t("appPages.collar.activity.resting")} <b className="font-semibold text-ink">{mix.restingPct}%</b></span>
              <span>{t("appPages.collar.activity.walking")} <b className="font-semibold text-ink">{mix.walkingPct}%</b></span>
              <span>{t("appPages.collar.activity.running")} <b className="font-semibold text-ink">{mix.runningPct}%</b></span>
            </div>
          </>
        ) : summary ? (
          // Only once the week has loaded: "no walks" while still loading would be a false claim.
          <p className="mt-3 text-sm text-ink-soft">{t("appPages.collar.week.empty")}</p>
        ) : null}
      </section>
    </div>
  );
}
