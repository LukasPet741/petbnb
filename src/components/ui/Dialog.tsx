"use client";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useIsPhone } from "@/hooks/useIsPhone";
import { arrive, sheet, SHEET_CLOSE_OFFSET, SHEET_CLOSE_VELOCITY, DUR, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import IconButton from "./IconButton";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one dialog (plan §2.3). On a phone it is a bottom sheet: it rises from below, has a
 * handle, and closes when dragged down. Above 640 px it is a centred card that arrives.
 * Either way: aria-modal, Tab stays inside, Escape and the scrim close it, focus goes
 * back to where it came from, and the page behind does not scroll.
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = "md",
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** A round tile above the title (Confirm's warning sign). */
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** What to focus first; default: the first focusable thing after the close button. */
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const { t } = useLanguage();
  const phone = useIsPhone();
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFirst = () => {
      const target =
        initialFocus?.current ??
        [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find((el) => !("dialogClose" in el.dataset)) ??
        panel.current;
      target?.focus();
    };
    const frame = requestAnimationFrame(focusFirst);
    focusFirst();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, initialFocus]);

  // Tab and Shift+Tab cycle inside the dialog.
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > SHEET_CLOSE_OFFSET || info.velocity.y > SHEET_CLOSE_VELOCITY) onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            className="absolute inset-0 glass-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.quick, ease: EASE.calm } }}
            exit={{ opacity: 0, transition: { duration: DUR.quick, ease: EASE.out } }}
            onClick={onClose}
            aria-hidden="true"
          />
          <div className={cn("absolute inset-0 flex pointer-events-none", phone ? "items-end" : "items-center justify-center p-4")}>
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              onKeyDown={trap}
              variants={phone ? sheet : arrive}
              initial="hidden"
              animate="show"
              exit="exit"
              {...(phone
                ? { drag: "y" as const, dragConstraints: { top: 0, bottom: 0 }, dragElastic: { top: 0, bottom: 0.6 }, onDragEnd }
                : {})}
              className={cn(
                "pointer-events-auto relative bg-surface shadow-[var(--shadow-lg)] outline-none overflow-y-auto overscroll-contain",
                phone
                  ? "w-full max-h-[92dvh] rounded-t-[var(--radius-hero)] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                  : cn("w-full max-h-[86dvh] rounded-[var(--radius-card)] p-6", size === "sm" ? "max-w-md" : size === "md" ? "max-w-lg" : "max-w-2xl"),
              )}
            >
              {phone && <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  {icon}
                  <h2 id={titleId} className="font-display text-xl font-bold leading-tight text-ink">
                    {title}
                  </h2>
                  {description && (
                    <p id={descId} className="text-sm leading-relaxed text-ink-soft">
                      {description}
                    </p>
                  )}
                </div>
                <IconButton label={t("common.ui.close")} tone="soft" onClick={onClose} data-dialog-close="">
                  <X className="w-4 h-4" aria-hidden="true" />
                </IconButton>
              </div>
              {children && <div className="mt-4">{children}</div>}
              {footer && <div className="mt-6">{footer}</div>}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
