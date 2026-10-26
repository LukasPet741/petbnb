import type { Locale } from "@/lib/i18n";

/**
 * Opening hours in OpenStreetMap's syntax ("Mo-Fr 09:00-18:00; Sa 10:00-14:00"), for the places
 * map's "Open now" filter. Only the plain forms are read: day ranges and lists, time ranges, "off",
 * "24/7". Anything else (public holidays, weeks, sunrise) makes the whole value unknown, and an
 * unknown place is never called open.
 */

/** Seven days, Monday first; each a list of [from, to) minutes since midnight. */
export type WeekHours = [number, number][][];

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY = "(?:Mo|Tu|We|Th|Fr|Sa|Su)";
const DAY_SPEC = new RegExp(`^${DAY}(?:-${DAY})?(?:,${DAY}(?:-${DAY})?)*$`);
const TIME_RANGE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

function days(spec: string | undefined): number[] {
  if (!spec) return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const [from, to] = part.split("-").map((d) => DAYS.indexOf(d));
    if (to === undefined) out.add(from);
    else for (let d = from; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === to) break;
    }
  }
  return [...out];
}

function times(spec: string): [number, number][] | null {
  if (/^(off|closed)$/i.test(spec)) return [];
  const out: [number, number][] = [];
  for (const range of spec.split(",")) {
    const m = range.trim().match(TIME_RANGE);
    if (!m) return null;
    const from = Number(m[1]) * 60 + Number(m[2]);
    const to = Number(m[3]) * 60 + Number(m[4]);
    if (from > 1440 || to > 1440) return null;
    out.push([from, to]);
  }
  return out;
}

export function parseOpeningHours(value: string | null | undefined): WeekHours | null {
  const text = value?.trim();
  if (!text) return null;
  if (text === "24/7") return Array.from({ length: 7 }, () => [[0, 1440]]);
  const week: WeekHours = Array.from({ length: 7 }, () => []);
  // Rules are separated by ";", or by a "," that ends a time (or "off") and starts a new day spec;
  // the comma in a day list ("Mo,We") is not a break.
  const rules = text.split(new RegExp(`;\\s*|(?<=\\d|off|closed),\\s*(?=${DAY})`, "i")).map((r) => r.trim()).filter(Boolean);
  for (const rule of rules) {
    const m = rule.match(/^(\S+)\s+(.+)$/);
    const daySpec = m && DAY_SPEC.test(m[1]) ? m[1] : undefined;
    const timeSpec = daySpec ? m![2] : rule;
    const ranges = times(timeSpec);
    if (!ranges) return null;
    // A later rule replaces earlier ones for the days it names (OSM's own rule).
    for (const d of days(daySpec)) week[d] = ranges.map((r) => [...r] as [number, number]);
  }
  return week;
}

/** The weekday (Monday = 0) and minute of the day in Vilnius, where every place is. */
function vilniusNow(date: Date): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vilnius", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function isOpenAt(week: WeekHours, date: Date): boolean {
  const { day, minute } = vilniusNow(date);
  const yesterday = (day + 6) % 7;
  const today = week[day].some(([from, to]) => (to > from ? minute >= from && minute < to : minute >= from));
  // A range that ends after midnight (20:00-02:00) is still open early the next morning.
  const carried = week[yesterday].some(([from, to]) => to <= from && minute < to);
  return today || carried;
}

const pad = (n: number) => `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** "Mon–Fri 09:00–18:00 · Sat 10:00–14:00", or "Every day 07:30–19:30", in the visitor's language. */
export function formatHours(week: WeekHours, locale: Locale): string {
  const dayName = (d: number) => new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { weekday: "short" })
    .format(new Date(Date.UTC(2026, 9, 26 + d)))
    .replace(/\.$/, "");
  const label = (ranges: [number, number][]) => ranges.map(([a, b]) => `${pad(a)}–${pad(b)}`).join(", ");
  const key = (d: number) => label(week[d]);
  if (week.every((_, d) => key(d) === key(0)) && week[0].length > 0) {
    return `${locale === "lt" ? "Kasdien" : "Every day"} ${key(0)}`;
  }
  const out: string[] = [];
  for (let d = 0; d < 7; ) {
    let end = d;
    while (end + 1 < 7 && key(end + 1) === key(d)) end++;
    if (week[d].length > 0) out.push(`${end > d ? `${dayName(d)}–${dayName(end)}` : dayName(d)} ${key(d)}`);
    d = end + 1;
  }
  return out.join(" · ");
}
