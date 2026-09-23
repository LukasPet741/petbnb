"use client";
import { useLanguage } from "@/context/LanguageContext";
import { monthGrid, type BusyKind } from "@/lib/availability";
import { cn } from "@/lib/utils";

const INTL_LOCALES = { en: "en-GB", lt: "lt-LT" } as const;
// 5 October 2026 was a Monday: used only to print weekday names Monday-first.
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 5 + i)));
const STATES = ["free", "off", "booked"] as const;
type DayState = (typeof STATES)[number];

const STATE_CLASS: Record<DayState, string> = {
  free: "bg-white/70 text-ink",
  off: "bg-amber-soft text-amber-strong line-through decoration-amber-strong/60",
  booked: "bg-brand text-white",
};
const SWATCH_CLASS: Record<DayState, string> = {
  free: "bg-white ring-1 ring-ink/15",
  off: "bg-amber-soft ring-1 ring-amber-strong/30",
  booked: "bg-brand",
};

/**
 * Two months of a sitter's days: free, away (a day off) or booked (an accepted booking).
 *
 * "edit" is the sitter's own view: a free or away day in the future is a toggle; booked days
 * are not, because a day off cannot undo an accepted booking. "view" is what an owner sees on a
 * profile: every day is a disabled button, so each still reads out its date and state.
 *
 * Days are "YYYY-MM-DD" in Vilnius (see lib/availability); `today` comes from the caller so the
 * component stays pure and testable. Every day is type="button" because the sitter's calendar
 * sits inside the profile form.
 */
export default function AvailabilityCalendar({
  busy,
  today,
  mode,
  onToggle,
  savingDay = null,
}: {
  busy: Map<string, BusyKind>;
  today: string;
  mode: "edit" | "view";
  /** Edit mode: the day tapped and whether it should become a day off. */
  onToggle?: (day: string, makeOff: boolean) => void;
  /** A day whose change is being saved; disabled until it lands. */
  savingDay?: string | null;
}) {
  const { t, locale } = useLanguage();
  const intl = INTL_LOCALES[locale as keyof typeof INTL_LOCALES] ?? INTL_LOCALES.en;
  const monthName = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" });
  const weekdayName = new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" });
  const dayName = new Intl.DateTimeFormat(intl, { day: "numeric", month: "long", timeZone: "UTC" });

  const [year, month] = today.split("-").map(Number);
  const months = [0, 1].map((k) => new Date(Date.UTC(year, month - 1 + k, 1)));

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        {months.map((first) => {
          const label = monthName.format(first);
          const cells = monthGrid(first.getUTCFullYear(), first.getUTCMonth());
          return (
            <div key={label}>
              <h3 className="mb-2 text-sm font-semibold capitalize text-ink">{label}</h3>
              <div role="grid" aria-label={label} className="grid grid-cols-7 gap-1">
                {WEEK.map((d) => (
                  <span key={d.getUTCDay()} role="columnheader" className="pb-1 text-center text-[11px] font-medium uppercase text-ink-soft">
                    {weekdayName.format(d)}
                  </span>
                ))}
                {cells.map((iso, i) => {
                  if (!iso) return <span key={`blank-${i}`} role="gridcell" />;
                  const kind = busy.get(iso);
                  const state: DayState = kind ?? "free";
                  const past = iso < today;
                  const toggleable = mode === "edit" && !past && state !== "booked";
                  const disabled = !toggleable || savingDay === iso;
                  return (
                    <span key={iso} role="gridcell">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onToggle?.(iso, state === "free")}
                        aria-label={`${iso} ${dayName.format(new Date(`${iso}T00:00:00Z`))}: ${t(`appPages.availability.state.${state}`)}`}
                        aria-pressed={toggleable ? state === "off" : undefined}
                        className={cn(
                          "grid min-h-11 w-full place-items-center rounded-[10px] text-sm tabular-nums transition-colors",
                          STATE_CLASS[state],
                          past && "opacity-35",
                          iso === today && "ring-2 ring-ink/60",
                          !disabled && "cursor-pointer hover:ring-2 hover:ring-brand focus-visible:outline-2 focus-visible:outline-brand",
                          savingDay === iso && "animate-pulse",
                        )}
                      >
                        {Number(iso.slice(8))}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <ul aria-label={t("appPages.availability.legend")} className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {STATES.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded", SWATCH_CLASS[state])} aria-hidden="true" />
            {t(`appPages.availability.state.${state}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
