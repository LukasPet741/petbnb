"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Footprints } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatClock, formatDayMonth } from "@/lib/collar/stats";
import {
  loadBookingWalks, startWalk, walkErrorKey, walkStats, type BookingWalks as Walks, type WalkErrorKey,
} from "@/lib/collar/walks";
import Button, { ButtonLink } from "@/components/ui/Button";

/**
 * The sitter's walks on one booking card (spec 2026-10-22-collar-walks-design): Start with the
 * owner's collar while the stay allows it, back into a walk still running, and the sitter's last
 * 3 walks on this booking. The database decides which collars may be walked; this only shows them.
 */
export default function BookingWalks({ bookingId }: { bookingId: string }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [walks, setWalks] = useState<Walks | null>(null);
  const [collarId, setCollarId] = useState<string | null>(null);
  const [error, setError] = useState<WalkErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    loadBookingWalks(bookingId)
      .then((loaded) => {
        if (alive) setWalks(loaded);
      })
      .catch(() => {
        // No walk controls is the safe answer when the booking's walks cannot be read.
      });
    return () => {
      alive = false;
    };
  }, [bookingId]);

  if (!walks || (walks.collars.length === 0 && !walks.running && walks.recent.length === 0)) return null;

  const chosen = collarId ?? walks.collars[0]?.id ?? null;
  const start = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      router.push(`/walks/${await startWalk(chosen, bookingId)}`);
    } catch (e) {
      setError(walkErrorKey(e));
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-ink/5 pt-3">
      {walks.running ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-sm font-semibold text-ink">{t("appPages.collar.walks.inProgress")}</p>
          <ButtonLink size="sm" href={`/walks/${walks.running.id}`}>{t("appPages.collar.walks.open")}</ButtonLink>
        </div>
      ) : walks.collars.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          {walks.collars.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              {t("appPages.collar.walks.pickCollar")}
              <select value={chosen ?? ""} onChange={(e) => setCollarId(e.target.value)}
                className="h-9 rounded-[var(--radius-input)] border border-ink/10 bg-surface px-2.5 text-sm text-ink">
                {walks.collars.map((c) => (
                  <option key={c.id} value={c.id}>{c.label?.trim() || t("appPages.collar.unnamed")}</option>
                ))}
              </select>
            </label>
          )}
          <Button size="sm" onClick={() => void start()} loading={busy} disabled={busy}>
            <Footprints className="h-4 w-4" aria-hidden="true" />
            {t("appPages.collar.walks.start")}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-amber-strong">
          {t(error === "walk_running" ? "appPages.collar.walks.running" : error === "not_allowed" ? "appPages.collar.walks.notAllowed" : "appPages.collar.walks.failed")}
        </p>
      )}

      {walks.recent.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {walks.recent.map((walk) => {
            const stats = walkStats(walk, Date.now());
            return (
              <li key={walk.id}>
                <Link href={`/walks/${walk.id}`} className="text-xs font-medium text-brand hover:text-brand-strong tabular-nums">
                  {`${formatDayMonth(walk.started_at, locale)}, ${formatClock(walk.started_at, locale)} · ${t("appPages.collar.walks.summary", { min: Math.round(stats.durationMin), km: stats.distanceKm.toFixed(1) })}`}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
