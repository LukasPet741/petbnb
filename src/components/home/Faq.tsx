"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";

const ITEMS = ["howItWorks", "cost", "areas", "becomeSitter", "realCompany"] as const;

export default function Faq() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="border-t border-black/5 bg-surface py-16 md:py-20">
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-8 text-center tracking-tight">
          {t("home.faq.title")}
        </h2>
        <div className="space-y-3">
          {ITEMS.map((key, i) => {
            const expanded = open === i;
            return (
              <div key={key} className="overflow-hidden rounded-[var(--radius-input)] border border-black/5 bg-canvas">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : i)}
                  aria-expanded={expanded}
                  aria-controls={`faq-panel-${key}`}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-brand-softer"
                >
                  <span className="pr-4 text-sm font-medium text-ink">{t(`home.faq.items.${key}.q`)}</span>
                  <motion.span
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.25 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={`faq-panel-${key}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 text-sm leading-relaxed text-ink-soft">
                        {t(`home.faq.items.${key}.a`)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
