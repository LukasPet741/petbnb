"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TIPS, type Tip } from "@/lib/tips";
import { useLanguage } from "@/context/LanguageContext";
import TipCard from "./TipCard";

const SEEN_KEY = "petbnb-tips-seen";

// Maps booking service types / pet types to the tag strings used in TIPS.
const SERVICE_TAG: Record<string, string> = {
  walking: "Walking",
  boarding: "Boarding",
  grooming: "Grooming",
};
const PET_TAG: Record<string, string> = {
  cat: "Cats",
};

export function loadSeenIds(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSeenIds(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable (e.g. private browsing) — rotation still works for this session.
  }
}

// Matching tips (by tag) first, the rest after, original order preserved within each group.
export function personalizedOrder(pets: { type: string }[], upcomingServices: string[]): Tip[] {
  const tags = new Set<string>();
  upcomingServices.forEach((service) => {
    const tag = SERVICE_TAG[service];
    if (tag) tags.add(tag);
  });
  pets.forEach((pet) => {
    const tag = PET_TAG[pet.type];
    if (tag) tags.add(tag);
  });
  if (tags.size === 0) return TIPS;
  const matching = TIPS.filter((tip) => tags.has(tip.tag));
  const rest = TIPS.filter((tip) => !tags.has(tip.tag));
  return [...matching, ...rest];
}

// Picks the first tip (in `order`) not yet marked seen, resetting the seen log once every
// tip has been shown. Records the pick as seen so the same tip doesn't open the next session too.
export function pickStartIndex(order: Tip[]): number {
  let seen = loadSeenIds();
  let startIndex = order.findIndex((tip) => !seen.includes(tip.id));
  if (startIndex === -1) {
    seen = [];
    startIndex = 0;
  }
  const shownId = order[startIndex]?.id;
  if (shownId && !seen.includes(shownId)) saveSeenIds([...seen, shownId]);
  return startIndex;
}

export default function TipWidget({
  intervalMs = 7000,
  pets = [],
  upcomingServices = [],
}: {
  intervalMs?: number;
  pets?: { type: string }[];
  upcomingServices?: string[];
}) {
  const { t } = useLanguage();
  const [order, setOrder] = useState<Tip[]>(TIPS);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  // Re-personalize whenever the caller's data actually changes (dashboard fetches pets/bookings
  // async, so this can't be mount-only). A stable string key avoids re-running on every unrelated
  // re-render from new (but equal) array props. No props passed (e.g. RightRail) => key is empty
  // => falls straight into the untouched default: full TIPS list from index 0, no localStorage.
  const personalizationKey = `${pets.map((p) => p.type).join(",")}|${upcomingServices.join(",")}`;
  useEffect(() => {
    if (pets.length === 0 && upcomingServices.length === 0) {
      setOrder(TIPS);
      setI(0);
      return;
    }
    const next = personalizedOrder(pets, upcomingServices);
    setOrder(next);
    setI(pickStartIndex(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalizationKey]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((p) => (p + 1) % order.length), intervalMs);
    return () => clearInterval(id);
  }, [paused, intervalMs, order.length]);

  return (
    // Touch has no hover: without a pointer handler the carousel keeps advancing under
    // the reader's finger, and tapping a dot never stops it.
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={(e) => { if (e.pointerType !== "mouse") setPaused(true); }}
    >
      <div className="relative h-64">
        <AnimatePresence>
          <motion.div
            key={order[i]?.id ?? i}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          >
            {order[i] && <TipCard tip={order[i]} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* progress dots */}
      <div className="flex flex-wrap justify-center mt-1">
        {order.map((tip, idx) => (
          // The painted pill stays 6px; the button around it is 44px tall so a thumb can
          // actually hit it. -my-3 keeps the row from growing in the layout.
          <button
            key={tip.id}
            onClick={() => setI(idx)}
            aria-label={t("appShell.tipWidget.dotAriaLabel", { index: idx + 1 })}
            className="group h-11 -my-3 px-1 flex items-center justify-center"
          >
            <span
              aria-hidden
              className={`block h-1.5 rounded-full transition-all ${idx === i ? "w-4 bg-brand" : "w-1.5 bg-black/15 group-hover:bg-black/30"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
