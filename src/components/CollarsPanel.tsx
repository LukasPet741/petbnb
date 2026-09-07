"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Copy, X, Radar, Check, Loader2, Route as RouteIcon, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import { useLanguage } from "@/context/LanguageContext";

const CollarMap = dynamic(() => import("@/components/CollarMap"), { ssr: false });

interface CollarDevice {
  id: string;
  label: string | null;
  created_at: string;
}

interface CollarFix {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  battery_pct: number | null;
  recorded_at: string;
}

interface RoutePoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

interface WeeklyRoutePoint extends RoutePoint {
  speed_kmh: number | null;
}

interface WeeklyStats {
  totalDistanceKm: number;
  mostActiveDate: string | null;
  mostActiveDistanceKm: number;
  activityBreakdown: { restingPct: number; walkingPct: number; runningPct: number } | null;
}

const POLL_INTERVAL_MS = 30_000;

// Activity-level thresholds (km/h) used to bucket points from the weekly route history.
const ACTIVITY_RESTING_MAX_KMH = 1;
const ACTIVITY_WALKING_MAX_KMH = 7;

export function todayInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
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
  const durationMin = (new Date(points[points.length - 1].recorded_at).getTime() - new Date(points[0].recorded_at).getTime()) / 60_000;
  return { distanceKm, durationMin };
}

/** Monday-through-Sunday date strings (YYYY-MM-DD, local time) for the week containing today. */
export function currentWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun ... 6 = Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const offset = d.getTimezoneOffset();
    dates.push(new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10));
  }
  return dates;
}

export function weekdayShort(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const raw = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-US", { weekday: "short" }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function CollarsPanel() {
  const { t, locale } = useLanguage();
  const [devices, setDevices] = useState<CollarDevice[]>([]);
  const [fixes, setFixes] = useState<Record<string, CollarFix | null>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [provisioned, setProvisioned] = useState<{ id: string; secret: string; label: string } | null>(null);
  const [routeOpenFor, setRouteOpenFor] = useState<string | null>(null);
  const [routeDate, setRouteDate] = useState(todayInputValue());
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<Record<string, WeeklyStats | null>>({});

  const loadDevices = useCallback(async () => {
    const { data } = await supabase
      .from("collar_devices")
      .select("id, label, created_at")
      .order("created_at", { ascending: false });
    setDevices((data ?? []) as CollarDevice[]);
    setLoading(false);
  }, []);

  const loadFixes = useCallback(async (deviceIds: string[]) => {
    const entries = await Promise.all(
      deviceIds.map(async (id) => {
        const { data } = await supabase
          .from("collar_locations")
          .select("lat, lng, speed_kmh, battery_pct, recorded_at")
          .eq("device_id", id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return [id, (data as CollarFix | null) ?? null] as const;
      })
    );
    setFixes(Object.fromEntries(entries));
  }, []);

  // Weekly totals need every ping across 7 days (~20k rows for an active collar), which risks
  // silent truncation from a single wide range query — so each day is fetched as its own
  // request (mirroring the single-day route query above) and aggregated client-side.
  const loadWeeklyStats = useCallback(async (deviceIds: string[]) => {
    const weekDates = currentWeekDates();
    const entries = await Promise.all(
      deviceIds.map(async (id) => {
        const dayResults = await Promise.all(
          weekDates.map(async (dateStr) => {
            const start = new Date(`${dateStr}T00:00:00`).toISOString();
            const end = new Date(`${dateStr}T23:59:59.999`).toISOString();
            const { data } = await supabase
              .from("collar_locations")
              .select("lat, lng, recorded_at, speed_kmh")
              .eq("device_id", id)
              .gte("recorded_at", start)
              .lte("recorded_at", end)
              .order("recorded_at", { ascending: true });
            return { date: dateStr, points: (data ?? []) as WeeklyRoutePoint[] };
          })
        );

        let totalDistanceKm = 0;
        let mostActiveDate: string | null = null;
        let mostActiveDistanceKm = 0;
        let restingPts = 0;
        let walkingPts = 0;
        let runningPts = 0;

        for (const { date, points } of dayResults) {
          const dayDistanceKm = routeStats(points)?.distanceKm ?? 0;
          totalDistanceKm += dayDistanceKm;
          if (dayDistanceKm > mostActiveDistanceKm) {
            mostActiveDistanceKm = dayDistanceKm;
            mostActiveDate = date;
          }
          for (const point of points) {
            if (point.speed_kmh == null) continue;
            if (point.speed_kmh < ACTIVITY_RESTING_MAX_KMH) restingPts++;
            else if (point.speed_kmh <= ACTIVITY_WALKING_MAX_KMH) walkingPts++;
            else runningPts++;
          }
        }

        const totalPts = restingPts + walkingPts + runningPts;
        const activityBreakdown =
          totalPts > 0
            ? {
                restingPct: Math.round((restingPts / totalPts) * 100),
                walkingPct: Math.round((walkingPts / totalPts) * 100),
                runningPct: Math.round((runningPts / totalPts) * 100),
              }
            : null;

        return [id, { totalDistanceKm, mostActiveDate, mostActiveDistanceKm, activityBreakdown } as WeeklyStats] as const;
      })
    );
    setWeeklyStats(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (devices.length === 0) return;
    const ids = devices.map((d) => d.id);
    loadFixes(ids);
    const interval = setInterval(() => loadFixes(ids), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [devices, loadFixes]);

  useEffect(() => {
    if (devices.length === 0) return;
    loadWeeklyStats(devices.map((d) => d.id));
  }, [devices, loadWeeklyStats]);

  useEffect(() => {
    if (!routeOpenFor) return;
    let active = true;
    setRouteLoading(true);
    const start = new Date(`${routeDate}T00:00:00`).toISOString();
    const end = new Date(`${routeDate}T23:59:59.999`).toISOString();
    supabase
      .from("collar_locations")
      .select("lat, lng, recorded_at")
      .eq("device_id", routeOpenFor)
      .gte("recorded_at", start)
      .lte("recorded_at", end)
      .order("recorded_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setRoutePoints((data ?? []) as RoutePoint[]);
        setRouteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [routeOpenFor, routeDate]);

  const toggleRoute = (deviceId: string) => {
    if (routeOpenFor === deviceId) {
      setRouteOpenFor(null);
    } else {
      setRouteOpenFor(deviceId);
      setRouteDate(todayInputValue());
      setRoutePoints([]);
    }
  };

  const handleCreate = async (label: string) => {
    const secret = crypto.randomUUID().replace(/-/g, "");
    const { data, error } = await supabase.rpc("register_collar_device", { p_secret: secret, p_label: label || null });
    if (error || !data) return;
    setProvisioned({ id: data as string, secret, label });
    setShowAdd(false);
    await loadDevices();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("collar_devices").delete().eq("id", id);
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div
      className="bg-surface rounded-2xl p-6 sm:p-7"
      style={{ boxShadow: "var(--shadow-lg), inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 0 0 1px rgb(31 92 71 / 0.08)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink tracking-tight">{t("appPages.collars.title")}</h3>
          <p className="text-sm text-ink-soft mt-0.5">{t("appPages.collars.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong hover:shadow-[var(--shadow-sm)] active:-translate-y-px transition-all duration-200 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />{t("appPages.collars.addCollarButton")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <EmptyState
          icon={Radar}
          title={t("appPages.collars.emptyTitle")}
          description={t("appPages.collars.emptyDescription")}
        />
      ) : (
        <div className="space-y-4">
          {devices.map((device) => {
            const fix = fixes[device.id];
            return (
              <div
                key={device.id}
                className="rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              >
                <div className="flex items-center justify-between px-4 py-3 bg-surface-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink text-sm truncate">{device.label || t("appPages.collars.unnamedCollar")}</div>
                    <div className="text-xs text-ink-soft mt-0.5">
                      {fix ? (
                        <>
                          {t("appPages.collars.lastSeenPrefix")} {timeAgo(fix.recorded_at, t, "appPages.collars")}
                          {fix.speed_kmh != null && ` · ${fix.speed_kmh.toFixed(1)} ${t("appPages.collars.speedUnit")}`}
                          {fix.battery_pct != null && ` · ${fix.battery_pct}% ${t("appPages.collars.batteryLabel")}`}
                        </>
                      ) : (
                        t("appPages.collars.waitingForFirstFix")
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleRoute(device.id)}
                      className="p-2 text-ink-soft hover:text-slate hover:bg-slate-soft rounded-lg transition-colors"
                      aria-label={t("appPages.collars.viewRouteAriaLabel")}
                    >
                      <RouteIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(device.id)}
                      className="p-2 text-ink-soft hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                      aria-label={t("appPages.collars.removeCollarAriaLabel")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {(() => {
                  const weekly = weeklyStats[device.id];
                  if (!weekly || weekly.totalDistanceKm <= 0) return null;
                  const breakdown = weekly.activityBreakdown;
                  return (
                    <div className="px-4 py-2.5 bg-surface border-b border-black/5">
                      <div className="flex items-center justify-between text-xs text-ink-soft tabular-nums">
                        <span className="flex items-center gap-1.5">
                          <RouteIcon className="w-3.5 h-3.5 text-slate" />
                          {t("appPages.collars.weeklyDistanceLabel", { distance: weekly.totalDistanceKm.toFixed(1) })}
                        </span>
                        {weekly.mostActiveDate && (
                          <span>{t("appPages.collars.mostActiveDayLabel", { day: weekdayShort(weekly.mostActiveDate, locale) })}</span>
                        )}
                      </div>
                      {breakdown && (
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full overflow-hidden flex bg-surface-2">
                            {breakdown.restingPct > 0 && <div style={{ width: `${breakdown.restingPct}%` }} className="bg-slate-soft" />}
                            {breakdown.walkingPct > 0 && <div style={{ width: `${breakdown.walkingPct}%` }} className="bg-brand-soft" />}
                            {breakdown.runningPct > 0 && <div style={{ width: `${breakdown.runningPct}%` }} className="bg-amber-soft" />}
                          </div>
                          <div className="flex justify-between text-[10px] text-ink-soft mt-1 tabular-nums">
                            <span>{t("appPages.collars.activityRestingLabel")} {breakdown.restingPct}%</span>
                            <span>{t("appPages.collars.activityWalkingLabel")} {breakdown.walkingPct}%</span>
                            <span>{t("appPages.collars.activityRunningLabel")} {breakdown.runningPct}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {fix ? (
                  <div className="h-56">
                    <CollarMap lat={fix.lat} lng={fix.lng} label={device.label ?? undefined} />
                  </div>
                ) : (
                  <div className="bg-surface-2">
                    <EmptyState
                      icon={Radar}
                      tone="encouraging"
                      title={t("appPages.collars.noLocationDataYet")}
                      description={t("appPages.collars.noLocationDataYetDescription")}
                    />
                  </div>
                )}

                <AnimatePresence>
                  {routeOpenFor === device.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-black/10"
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2 border-b border-black/10">
                        <div className="flex items-center gap-2 text-xs font-medium text-ink">
                          <RouteIcon className="w-3.5 h-3.5 text-slate" />{t("appPages.collars.routeLabel")}
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="date"
                            value={routeDate}
                            max={todayInputValue()}
                            onChange={(e) => setRouteDate(e.target.value)}
                            className="h-8 px-2 rounded-lg border border-black/10 bg-surface text-xs text-ink"
                          />
                          <button onClick={() => setRouteOpenFor(null)} className="p-1 text-ink-soft hover:text-ink rounded" aria-label={t("appPages.collars.closeRouteAriaLabel")}>
                            <ChevronUp className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {routeLoading ? (
                        <div className="flex items-center justify-center py-8 text-ink-soft">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : routePoints.length === 0 ? (
                        <div className="py-8 text-center text-sm text-ink-soft">{t("appPages.collars.noLocationDataForDay")}</div>
                      ) : (
                        <>
                          <div className="relative h-56">
                            <CollarMap
                              lat={routePoints[routePoints.length - 1].lat}
                              lng={routePoints[routePoints.length - 1].lng}
                              path={routePoints.slice(0, -1)}
                            />
                            {(() => {
                              const stats = routeStats(routePoints);
                              return (
                                /* Floated over the live tiles rather than stacked under them: the
                                   OpenStreetMap raster is the only backdrop in this app varied
                                   enough for frosted glass to do real optical work.
                                   z-[800] clears Leaflet's own panes (400-700), and
                                   pointer-events-none keeps map drag and zoom working through it. */
                                <div className="glass-panel pointer-events-none absolute inset-x-2 bottom-2 z-[800] rounded-[var(--radius-input)] border px-3 py-2 text-xs text-ink tabular-nums">
                                  {stats
                                    ? t("appPages.collars.routeStatsSummary", { distance: stats.distanceKm.toFixed(2), duration: Math.round(stats.durationMin), points: routePoints.length })
                                    : routePoints.length === 1
                                      ? t("appPages.collars.routeNotEnoughSingular", { points: routePoints.length })
                                      : t("appPages.collars.routeNotEnoughPlural", { points: routePoints.length })}
                                </div>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showAdd && <AddCollarModal onClose={() => setShowAdd(false)} onCreate={handleCreate} />}
        {provisioned && <ProvisionedModal {...provisioned} onClose={() => setProvisioned(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      /* NOTE: this element animates its own opacity, and an element with opacity < 1
         becomes a "backdrop root" per Filter Effects L2 — so the blur only engages
         once the fade completes. Accepted deliberately; fixing it means restructuring
         the mount animation. */
      className="fixed inset-0 z-50 glass-scrim flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl w-full max-w-sm p-6"
        style={{ boxShadow: "var(--shadow-lg), inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 0 0 1px rgb(31 92 71 / 0.08)" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function AddCollarModal({ onClose, onCreate }: { onClose: () => void; onCreate: (label: string) => Promise<void> }) {
  const { t } = useLanguage();
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display text-lg font-semibold text-ink">{t("appPages.collars.addCollarModalTitle")}</h4>
        <button onClick={onClose} className="p-1 text-ink-soft hover:text-ink rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>
      <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.collars.labelFieldLabel")}</label>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("appPages.collars.labelPlaceholder")}
        className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition mb-5"
      />
      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await onCreate(label);
          setSaving(false);
        }}
        className="w-full h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("appPages.collars.createCollarButton")}
      </button>
    </ModalShell>
  );
}

function ProvisionedModal({ id, secret, label, onClose }: { id: string; secret: string; label: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const envSnippet = `DEVICE_ID=${id}\nDEVICE_SECRET=${secret}`;

  const copy = () => {
    navigator.clipboard.writeText(envSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalShell onClose={onClose}>
      <h4 className="font-display text-lg font-semibold text-ink mb-1.5">{t("appPages.collars.pairedTitle", { label: label || t("appPages.collars.collarFallbackName") })}</h4>
      <p className="text-sm text-ink-soft mb-4">
        {t("appPages.collars.envInstructionsPrefix")} <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">.env</code> {t("appPages.collars.envInstructionsSuffix")}
      </p>
      <pre className="bg-surface-2 rounded-xl p-3.5 text-xs text-ink font-mono overflow-x-auto mb-4 whitespace-pre-wrap break-all">
        {envSnippet}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex-1 h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? t("appPages.collars.copiedLabel") : t("appPages.collars.copyLabel")}
        </button>
        <button
          onClick={onClose}
          className="flex-1 h-11 flex items-center justify-center bg-surface-2 text-ink rounded-xl text-sm font-medium hover:bg-black/5 transition-colors"
        >
          {t("appPages.collars.doneButton")}
        </button>
      </div>
    </ModalShell>
  );
}
