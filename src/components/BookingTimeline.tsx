"use client";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { timelineSteps } from "@/lib/booking-timeline";
import { cn } from "@/lib/utils";

/**
 * Requested → accepted → in progress → completed, with the step the booking waits on pulsing.
 * Renders nothing for cancelled and declined bookings (see timelineSteps).
 */
export default function BookingTimeline({
  status,
  endAt,
  now = Date.now(),
  className,
}: {
  status: string;
  endAt: string;
  now?: number;
  className?: string;
}) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const steps = timelineSteps(status, endAt, now);
  if (!steps) return null;

  // A connector is filled when the step it leads into has been reached.
  const lineClass = (reached: boolean) => cn("h-0.5 flex-1 rounded-full", reached ? "bg-brand" : "bg-ink/10");

  return (
    <ol aria-label={t("appPages.bookings.timeline.label")} className={cn("grid grid-cols-4", className)}>
      {steps.map((step, i) => {
        const next = steps[i + 1];
        return (
          <li
            key={step.key}
            data-state={step.state}
            aria-current={step.state === "current" ? "step" : undefined}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <div className="flex w-full items-center">
              <span className={cn(lineClass(step.state !== "todo"), i === 0 && "invisible")} />
              <span
                className={cn(
                  "relative grid h-5 w-5 flex-shrink-0 place-items-center rounded-full",
                  step.state === "done" && "bg-brand text-white",
                  step.state === "current" && "bg-white ring-2 ring-brand",
                  step.state === "todo" && "bg-white ring-1 ring-ink/15",
                )}
              >
                {step.state === "done" && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                {step.state === "current" && (
                  <>
                    <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                    {!reduceMotion && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full ring-2 ring-brand"
                        animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                  </>
                )}
              </span>
              <span className={cn(lineClass(Boolean(next) && next.state !== "todo"), !next && "invisible")} />
            </div>
            <span
              className={cn(
                "text-[11px] leading-tight",
                step.state === "todo" ? "text-ink-soft/70" : "font-medium text-ink",
              )}
            >
              {t(`appPages.bookings.timeline.${step.key}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
