/**
 * The date and distance maths behind the collar page, moved out of CollarsPanel (2026-09-26).
 * All of it is timezone sensitive; the test suite pins TZ to Europe/Vilnius.
 */

export interface RoutePoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

export interface SpeedPoint extends RoutePoint {
  speed_kmh: number | null;
}

/** YYYY-MM-DD of a moment, in local time. */
export function localDateString(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function todayInputValue(): string {
  return localDateString(new Date());
}

/** The first and last instant of a local day, as ISO strings for a range query. */
export function dayBounds(date: string): { from: string; to: string } {
  return {
    from: new Date(`${date}T00:00:00`).toISOString(),
    to: new Date(`${date}T23:59:59.999`).toISOString(),
  };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function routeStats(points: RoutePoint[]): { distanceKm: number; durationMin: number } | null {
  if (points.length < 2) return null;
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) distanceKm += haversineKm(points[i - 1], points[i]);
  const durationMin =
    (new Date(points[points.length - 1].recorded_at).getTime() - new Date(points[0].recorded_at).getTime()) / 60_000;
  return { distanceKm, durationMin };
}

/** The last seven local dates, oldest first, ending today. Built at local noon so DST never skips a day. */
export function lastSevenDates(): string[] {
  const now = new Date();
  const dates: string[] = [];
  for (let back = 6; back >= 0; back--) {
    dates.push(localDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 12)));
  }
  return dates;
}

export function weekdayShort(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const raw = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-US", { weekday: "short" }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const intlLocale = (locale: string) => (locale === "lt" ? "lt-LT" : "en-GB");

export function formatClock(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export function formatDayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long" }).format(new Date(iso));
}

export const ACTIVITY_RESTING_MAX_KMH = 1;
export const ACTIVITY_WALKING_MAX_KMH = 7;

export type Activity = "resting" | "walking" | "running";

export function activityOf(speedKmh: number): Activity | null {
  if (!Number.isFinite(speedKmh)) return null;
  if (speedKmh < ACTIVITY_RESTING_MAX_KMH) return "resting";
  if (speedKmh <= ACTIVITY_WALKING_MAX_KMH) return "walking";
  return "running";
}

export interface ActivityMix {
  restingPct: number;
  walkingPct: number;
  runningPct: number;
}

/** Percentages that always add up to 100 (largest remainder), so the bar never shows a gap. */
export function activityMix(counts: { resting: number; walking: number; running: number }): ActivityMix | null {
  const total = counts.resting + counts.walking + counts.running;
  if (total === 0) return null;
  const exact = [counts.resting, counts.walking, counts.running].map((n) => (n / total) * 100);
  const pct = exact.map(Math.floor);
  let left = 100 - pct.reduce((sum, n) => sum + n, 0);
  const byRemainder = exact.map((value, i) => ({ i, rest: value - pct[i] })).sort((a, b) => b.rest - a.rest);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    pct[i] += 1;
    left -= 1;
  }
  return { restingPct: pct[0], walkingPct: pct[1], runningPct: pct[2] };
}

export interface DaySummary {
  date: string;
  distanceKm: number;
}

export interface WeekSummary {
  days: DaySummary[];
  totalDistanceKm: number;
  activity: ActivityMix | null;
}

export function summarizeWeek(days: { date: string; points: SpeedPoint[] }[]): WeekSummary {
  const counts = { resting: 0, walking: 0, running: 0 };
  let totalDistanceKm = 0;
  const summaries = days.map(({ date, points }) => {
    const distanceKm = routeStats(points)?.distanceKm ?? 0;
    totalDistanceKm += distanceKm;
    for (const point of points) {
      const activity = point.speed_kmh == null ? null : activityOf(point.speed_kmh);
      if (activity) counts[activity] += 1;
    }
    return { date, distanceKm };
  });
  return { days: summaries, totalDistanceKm, activity: activityMix(counts) };
}
