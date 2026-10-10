"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { AlertCircle, Check, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { DUR, EASE, SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Toasts (plan §2.3–2.4): a few words on what just happened, on the brand's pine — never
 * black, never an amber pill. An action (Undo, Retry) is an underlined text button and
 * keeps the toast up for 5 s with a draining line. Swipe it sideways to dismiss. On a
 * phone it sits above the tab bar (--pb-bottom-nav, set by the app layout).
 */

export interface ToastOptions {
  message: string;
  tone?: "success" | "info" | "error";
  action?: { label: string; onAction: () => void };
  duration?: number;
}

type Item = ToastOptions & { id: number };

const ToastContext = createContext<(options: ToastOptions) => void>(() => {});
let sequence = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback((options: ToastOptions) => {
    const id = ++sequence;
    setItems((xs) => [...xs.slice(-2), { ...options, id }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4 pointer-events-none sm:inset-x-auto sm:right-6 sm:items-end"
        style={{ bottom: "calc(var(--pb-bottom-nav, 0px) + max(1rem, env(safe-area-inset-bottom)))" }}
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ToastItem key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

function ToastItem({ item, onDismiss }: { item: Item; onDismiss: (id: number) => void }) {
  const { t } = useLanguage();
  const duration = item.duration ?? (item.action ? 5000 : 3500);
  const dismissRef = useRef(() => onDismiss(item.id));
  dismissRef.current = () => onDismiss(item.id);

  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 500) dismissRef.current();
  };

  const error = item.tone === "error";
  const Icon = error ? AlertCircle : Check;

  return (
    <motion.div
      layout
      role={error ? "alert" : "status"}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
      exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: DUR.quick, ease: EASE.out } }}
      drag="x"
      dragSnapToOrigin
      onDragEnd={onDragEnd}
      className={cn(
        "pointer-events-auto w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] text-white shadow-[var(--shadow-lg)] touch-pan-y cursor-grab active:cursor-grabbing",
        error ? "bg-danger" : "bg-brand-strong",
      )}
    >
      <div className="flex min-h-12 items-center gap-3 py-2 pl-4 pr-2">
        <Icon className="w-4 h-4 flex-shrink-0 text-brand-soft" strokeWidth={2.6} aria-hidden="true" />
        <span className="flex-1 text-sm font-semibold">{item.message}</span>
        {item.action ? (
          <button
            type="button"
            onClick={() => {
              item.action!.onAction();
              dismissRef.current();
            }}
            className="pb-press h-9 rounded-full px-3 text-sm font-bold text-linen underline underline-offset-4 hover:bg-brand focus-visible:outline-2 focus-visible:outline-linen"
          >
            {item.action.label}
          </button>
        ) : (
          <button
            type="button"
            aria-label={t("common.ui.dismiss")}
            onClick={() => dismissRef.current()}
            className="pb-press inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-soft hover:bg-brand focus-visible:outline-2 focus-visible:outline-linen"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {item.action && (
        <motion.div
          aria-hidden="true"
          className="h-[3px] origin-left bg-linen/55"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}
