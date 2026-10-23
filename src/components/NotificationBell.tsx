"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationsContext";
import { cn } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/motion";
import type { AppNotification } from "@/lib/types";
import { notificationActor, notificationHref, notificationMeta, notificationSentence } from "@/lib/notification-text";
import Avatar from "./Avatar";

/**
 * Bell + popover over the shared NotificationsContext. It never touches Supabase:
 * the provider owns the query, the realtime channel and the read-marking RPCs.
 */
/**
 * `align` picks which edge the panel hangs from. "right" suits a right-aligned
 * trigger in a full-width bar; "left" is for the 256px desktop rail, where a
 * right-anchored 320-384px panel would open off the left edge of the screen.
 *
 * The panel is portalled to <body> and fixed next to the bell: the desktop rail scrolls
 * (overflow-y-auto), which also clips sideways, and cut a nested panel off at its edge.
 */
const GAP = 8; // px between the bell and the panel, and the panel's least distance from the screen edge

export default function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const { t } = useLanguage();
  const { notifications, unreadCount, loading, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  // Where the panel goes, from the bell's place on screen at the moment it opens.
  const measure = (): CSSProperties => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return {};
    const top = r.bottom + GAP;
    if (align === "left") return { top, left: Math.max(GAP, r.left) };
    return { top, right: Math.max(GAP, window.innerWidth - r.right) };
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onResize = () => setPlace(measure());
    window.addEventListener("resize", onResize);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // measure reads only refs and `align`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Shared with the dashboard's feed, so a notification reads the same in both places.
  const actorName = (n: AppNotification) => notificationActor(n, t);
  const sentence = (n: AppNotification) => notificationSentence(n, t);

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
        onClick={() => {
          if (!open) setPlace(measure());
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? t("messages.notifications.bellAriaLabelUnread", { count: unreadCount })
            : t("messages.notifications.bellAriaLabel")
        }
        // Lives on the deep-green chrome (top bar and rail), so it takes the chrome colours.
        className="relative w-11 h-11 flex items-center justify-center rounded-lg text-chrome-ink-soft hover:text-chrome-ink hover:bg-[var(--chrome-active)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full bg-brand text-on-brand text-[10px] font-semibold leading-none tabular-nums shadow-[var(--shadow-sm)]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ position: "fixed", ...place, transformOrigin: align === "left" ? "top left" : "top right" }}
            className="z-[60] w-80 sm:w-96 max-w-[calc(100vw-16px)] max-h-[70dvh] overflow-y-auto overscroll-contain bg-surface rounded-2xl border border-ink/5 shadow-[var(--shadow-lg)]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-surface border-b border-ink/5">
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
                className="divide-y divide-ink/5"
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
                        <p className="text-xs text-ink-soft mt-0.5">{notificationMeta(n, t)}</p>
                      </div>
                      {!n.read_at && (
                        <span aria-hidden="true" className="w-2 h-2 mt-1.5 rounded-full bg-brand flex-shrink-0" />
                      )}
                    </>
                  );

                  const href = notificationHref(n);
                  return (
                    <motion.div key={n.id} variants={fadeUp}>
                      {href ? (
                        <Link
                          href={href}
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

            <div className="sticky bottom-0 bg-surface border-t border-ink/5 px-4 py-2.5">
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
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
}
