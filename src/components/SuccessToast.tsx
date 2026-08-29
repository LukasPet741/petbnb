"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface SuccessToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

const ELEVATED_SHADOW = "var(--shadow-lg), inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 0 0 1px rgb(31 92 71 / 0.08)";

// Small, calm, non-modal confirmation — fades/slides in from the bottom and auto-dismisses.
// Not a toast library: built from scratch with framer-motion, which is already a dependency.
export default function SuccessToast({ message, onDismiss, duration = 2500 }: SuccessToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="pointer-events-auto flex items-center gap-2.5 bg-surface text-ink rounded-full pl-3 pr-4 py-2.5"
            style={{ boxShadow: ELEVATED_SHADOW }}
          >
            <span className="w-6 h-6 rounded-full bg-brand-soft flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
            </span>
            <span className="text-sm font-medium">{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
