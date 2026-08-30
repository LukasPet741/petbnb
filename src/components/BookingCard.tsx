"use client";
import Link from "next/link";
import { MapPin, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { STATUS_CONFIG, type BookingStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import Avatar from "@/components/Avatar";

interface BookingCardBooking {
  id: string;
  status: string;
  service: string;
  start_at: string;
  end_at: string;
  notes: string | null;
  address: string | null;
  pet: { id: string; name: string; photo_url?: string | null } | null;
}

interface BookingCardProps {
  booking: BookingCardBooking;
  isSitterView: boolean;
  displayProfile: { full_name: string | null; avatar_url: string | null } | null;
  displayLabel: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onMarkCompleted?: () => void;
}

const ELEVATED_SHADOW = "var(--shadow-lg), inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 0 0 1px rgb(31 92 71 / 0.08)";

// Relative/countdown framing for an upcoming start date, e.g. "Today" / "Tomorrow" / "in 5 days".
// Returns null for bookings that already started (a countdown to the past doesn't make sense).
function getRelativeLabel(startAt: string, t: (key: string, vars?: Record<string, string | number>) => string): string | null {
  const start = new Date(startAt);
  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startDay.getTime() - nowDay.getTime()) / 86_400_000);
  if (diffDays < 0) return null;
  if (diffDays === 0) return t("appPages.bookings.relativeToday");
  if (diffDays === 1) return t("appPages.bookings.relativeTomorrow");
  return t("appPages.bookings.relativeInDays", { days: diffDays });
}

export default function BookingCard({ booking, isSitterView, displayProfile, displayLabel, onAccept, onDecline, onCancel, onMarkCompleted }: BookingCardProps) {
  const { t, locale } = useLanguage();
  const status = STATUS_CONFIG[booking.status as BookingStatus];
  const photo = booking.pet?.photo_url || displayProfile?.avatar_url || null;
  const isPending = booking.status === "pending";
  const relative = getRelativeLabel(booking.start_at, t);
  const threadHref = `/messages/${booking.id}`;
  const messageLabel = t("appShell.sidebar.nav.messages");

  // Pending: the decision that still needs making. Big, elevated, photo-led, exactly the buttons that apply.
  if (isPending) {
    return (
      <motion.div
        layout
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-surface rounded-[var(--radius-card)] overflow-hidden grid grid-cols-1 sm:grid-cols-[180px_1fr]"
        style={{ boxShadow: ELEVATED_SHADOW }}
      >
        <div className="relative h-40 sm:h-full">
          {photo ? (
            <img src={photo} alt={booking.pet?.name ?? displayProfile?.full_name ?? ""} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-brand-softer flex items-center justify-center">
              <Avatar name={displayProfile?.full_name ?? booking.pet?.name ?? "?"} url={null} size="xl" />
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status?.color ?? ""}`}>
              {t(`common.bookingStatus.${booking.status}`)}
            </span>
            {relative && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-soft text-brand-strong">
                {relative}
              </span>
            )}
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-ink mt-2.5 leading-tight">
            {formatDate(booking.start_at, locale)} – {formatDate(booking.end_at, locale)}
          </h3>
          <p className="text-sm text-ink-soft mt-1">
            {booking.pet?.name} · {t(`common.services.${booking.service}`)} · {displayLabel} {displayProfile?.full_name}
          </p>
          {(booking.notes || booking.address) && (
            <div className="mt-3 space-y-1">
              {booking.address && <span className="flex items-center gap-1.5 text-xs text-ink-soft"><MapPin className="w-3.5 h-3.5" />{booking.address}</span>}
              {booking.notes && <p className="text-sm text-ink-soft/80 italic">&ldquo;{booking.notes}&rdquo;</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2.5 mt-4">
            {!isSitterView && (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onCancel}
                className="px-4 py-2 bg-danger-soft text-danger rounded-full text-xs font-semibold hover:brightness-95 transition-all">
                {t("appPages.bookings.cancelRequestButton")}
              </motion.button>
            )}
            {isSitterView && (
              <>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onAccept}
                  className="px-5 py-2 bg-brand text-white rounded-full text-xs font-semibold hover:bg-brand-strong transition-colors">
                  {t("appPages.bookings.acceptButton")}
                </motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onDecline}
                  className="px-5 py-2 bg-transparent border border-black/10 text-ink-soft rounded-full text-xs font-semibold hover:bg-surface-2 transition-colors">
                  {t("appPages.bookings.declineButton")}
                </motion.button>
              </>
            )}
            <Link href={threadHref}
              className="px-4 py-2 rounded-full text-xs font-semibold text-ink-soft inline-flex items-center gap-1.5 hover:bg-surface-2 hover:text-ink transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />{messageLabel}
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  // Resolved: a record, not a decision. Flat, compact, quiet — one small housekeeping action at most.
  return (
    <motion.div layout exit={{ opacity: 0, scale: 0.97 }} className="bg-surface border border-black/5 rounded-[var(--radius-card)] px-4 py-3 flex items-center gap-3">
      {photo ? (
        <img src={photo} alt={booking.pet?.name ?? ""} className="w-11 h-11 rounded-[var(--radius-input)] object-cover flex-shrink-0" />
      ) : (
        <Avatar name={displayProfile?.full_name ?? booking.pet?.name ?? "?"} url={null} size="md" className="rounded-[var(--radius-input)]" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink truncate">
          {formatDate(booking.start_at, locale)}{relative ? ` · ${relative}` : ""} · {t(`common.services.${booking.service}`)}
        </div>
        <div className="text-xs text-ink-soft truncate">{booking.pet?.name} · {displayLabel} {displayProfile?.full_name}</div>
      </div>
      <Link href={threadHref} aria-label={messageLabel} title={messageLabel}
        className="text-xs font-semibold text-brand hover:text-brand-strong transition-colors inline-flex items-center gap-1 flex-shrink-0">
        <MessageCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{messageLabel}</span>
      </Link>
      {isSitterView && booking.status === "signed" && (
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onMarkCompleted}
          className="px-3 py-1.5 bg-brand-soft text-brand-strong rounded-full text-xs font-semibold hover:brightness-95 transition-all flex-shrink-0">
          {t("appPages.bookings.markCompletedButton")}
        </motion.button>
      )}
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${status?.color ?? ""}`}>
        {t(`common.bookingStatus.${booking.status}`)}
      </span>
    </motion.div>
  );
}
