"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationsContext";
import { cn, timeAgo } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/motion";
import type { AppNotification } from "@/lib/types";
import Avatar from "./Avatar";

/**
 * Bell + popover over the shared NotificationsContext. It never touches Supabase:
 * the provider owns the query, the realtime channel and the read-marking RPCs.
 */
/**
 * `align` picks which edge the panel hangs from. "right" suits a right-aligned
 * trigger in a full-width bar; "left" is for the 256px desktop rail, where a
 * right-anchored 320-384px panel would open off the left edge of the screen.
 */
export default function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const { t } = useLanguage();
  const { notifications, unreadCount, loading, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const actorName = (n: AppNotification) => n.actor?.full_name ?? t("messages.unknownPerson");

  // No display text is stored on the row: the sentence is rebuilt from the type
  // plus the joined actor/booking/pet on every render, in the active locale.
  const sentence = (n: AppNotification) =>
    t(`messages.notifications.${n.type}`, {
      actor: actorName(n),
      pet: n.booking?.pet?.name ?? t("messages.notifications.fallbackPet"),
      // Only booking_requested interpolates {service}; without the booking join it
      // collapses to nothing rather than leaking a raw translation key.
      service: n.booking?.service ? t(`common.services.${n.booking.service}`) : "",
    });

  const openRow = (n: AppNotification) => {
    if (!n.read_at) void markRead([n.id]);
    setOpen(false);
  };

  // The provider keeps up to 50 rows; at the usual cadence the last ones would
  // still be arriving after the list has been read, so long lists stagger flatter.
  const listStagger = notifications.length > 12 ? 0.012 : 0.05;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? t("messages.notifications.bellAriaLabelUnread", { count: unreadCount })
            : t("messages.notifications.bellAriaLabel")
        }
        className="relative w-11 h-11 flex items-center justify-center rounded-lg text-ink-soft hover:text-ink hover:bg-brand-softer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full bg-brand text-white text-[10px] font-semibold leading-none tabular-nums shadow-[var(--shadow-sm)]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ transformOrigin: align === "left" ? "top left" : "top right" }}
            className={cn(
              "absolute top-full mt-2 z-50 w-80 sm:w-96 max-h-[70dvh] overflow-y-auto overscroll-contain bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-lg)]",
              align === "left" ? "left-0" : "right-0"
            )}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-surface border-b border-black/5">
              <h2 id={titleId} className="font-display text-base font-semibold text-ink">
                {t("messages.notifications.title")}
              </h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs font-medium text-brand hover:text-brand-strong transition-colors rounded-lg px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {t("messages.notifications.markAllRead")}
                </button>
              )}
            </div>

            {loading && notifications.length === 0 ? (
              <div className="px-4 py-3 space-y-3.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-2 animate-pulse" />
                    <div className="flex-1 space-y-1.5 pt-1">
                      <div className="h-3 rounded bg-surface-2 animate-pulse" />
                      <div className="h-3 w-16 rounded bg-surface-2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-ink">{t("messages.notifications.empty")}</p>
                <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">
                  {t("messages.notifications.emptyHint")}
                </p>
              </div>
            ) : (
              <motion.div
                variants={stagger(listStagger)}
                initial="hidden"
                animate="show"
                className="divide-y divide-black/5"
              >
                {notifications.map((n) => {
                  const rowClass = cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors",
                    n.read_at ? "hover:bg-brand-softer" : "bg-brand-softer hover:bg-brand-soft/60"
                  );
                  const inner = (
                    <>
                      <Avatar name={actorName(n)} url={n.actor?.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink leading-snug">{sentence(n)}</p>
                        <p className="text-xs text-ink-soft mt-0.5">{timeAgo(n.created_at, t)}</p>
                      </div>
                      {!n.read_at && (
                        <span aria-hidden="true" className="w-2 h-2 mt-1.5 rounded-full bg-brand flex-shrink-0" />
                      )}
                    </>
                  );

                  return (
                    <motion.div key={n.id} variants={fadeUp}>
                      {n.booking_id ? (
                        <Link
                          href={`/messages/${n.booking_id}`}
                          onClick={() => openRow(n)}
                          className={cn(
                            rowClass,
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                          )}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className={rowClass}>{inner}</div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            <div className="sticky bottom-0 bg-surface border-t border-black/5 px-4 py-2.5">
              <Link
                href="/messages"
                onClick={() => setOpen(false)}
                className="block text-center text-sm font-medium text-brand hover:text-brand-strong transition-colors rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t("messages.notifications.viewAll")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
