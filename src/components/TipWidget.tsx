"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TIPS } from "@/lib/tips";
import { useLanguage } from "@/context/LanguageContext";
import TipCard from "./TipCard";

export default function TipWidget({ intervalMs = 7000 }: { intervalMs?: number }) {
  const { t } = useLanguage();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % TIPS.length), intervalMs);
    return () => clearInterval(t);
  }, [paused, intervalMs]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative h-64">
        <AnimatePresence>
          <motion.div
            key={i}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          >
            <TipCard tip={TIPS[i]} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* progress dots */}
      <div className="flex flex-wrap justify-center gap-1.5 mt-3">
        {TIPS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={t("appShell.tipWidget.dotAriaLabel", { index: idx + 1 })}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-4 bg-brand" : "w-1.5 bg-black/15 hover:bg-black/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
