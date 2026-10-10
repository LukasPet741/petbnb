import type { Transition, Variants } from "framer-motion";

/**
 * "Calm" — PetBnB's one motion language (docs/design/unification-plan.md §2.2).
 *
 * Every framer-motion value in the app comes from here; plain elements use the matching
 * CSS tokens and classes in globals.css (--dur-*, --ease-*, .pb-press, .pb-skeleton).
 * One thing moves per action, text never animates its layout, and reduced motion turns
 * all of it into a short fade (MotionRoot sets reducedMotion="user" for the whole app).
 */

/** Durations in seconds, mirroring --dur-press / --dur-quick / --dur-calm / --dur-slow. */
export const DUR = { press: 0.12, quick: 0.2, calm: 0.32, slow: 0.5 } as const;

/** Mirroring --ease-calm (things arriving) and --ease-out (things leaving). */
export const EASE = {
  calm: [0.22, 1, 0.36, 1] as [number, number, number, number],
  out: [0.4, 0, 1, 1] as [number, number, number, number],
};

/** A firm spring for presses and snapping sheets; a softer one for indicators that glide. */
export const SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.8 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 340, damping: 32 } as const;

const calm: Transition = { duration: DUR.calm, ease: EASE.calm };
const out: Transition = { duration: DUR.quick, ease: EASE.out };

/** arrive: something new appears — a created item, a dialog, a toast, a page. */
export const arrive: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: calm },
  exit: { opacity: 0, scale: 0.98, transition: out },
};

/** depart: an erased thing leaves (fade + scale to 0.98), then the gap closes. */
export const depart = { opacity: 0, scale: 0.98, transition: out };

/** reveal: a list entering the screen, its children arriving 60 ms apart. */
export const reveal = (gap = 0.06): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap } },
});

/** swap: a cross-fade between tabs and filter results. */
export const swap: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.quick, ease: EASE.calm } },
  exit: { opacity: 0, transition: { duration: DUR.quick, ease: EASE.out } },
};

// The two shadow levels as literals: framer interpolates numbers, not var(--shadow-*).
const SHADOW_RAISED = "0 1px 2px rgba(19, 26, 23, 0.06), 0 1px 1px rgba(19, 26, 23, 0.04)";
const SHADOW_FLOATING = "0 6px 16px rgba(19, 26, 23, 0.10), 0 2px 6px rgba(19, 26, 23, 0.06)";

/** lift: a hoverable card rises 2 px and its shadow deepens (pointer devices). */
export const lift = {
  rest: { y: 0, boxShadow: SHADOW_RAISED },
  hover: { y: -2, boxShadow: SHADOW_FLOATING, transition: { duration: DUR.quick, ease: EASE.calm } },
};

/** press: framer buttons scale to 0.97 on tap; plain ones use the .pb-press class. */
export const press = { whileTap: { scale: 0.97 }, transition: SPRING };

/** The bottom sheet rises from below and closes when dragged past either threshold. */
export const sheet: Variants = {
  hidden: { y: "100%" },
  show: { y: 0, transition: { type: "spring", stiffness: 380, damping: 38 } },
  exit: { y: "100%", transition: { duration: DUR.quick, ease: EASE.out } },
};
export const SHEET_CLOSE_OFFSET = 120;
export const SHEET_CLOSE_VELOCITY = 600;

/** The page itself arrives on every navigation (app/(app)/template.tsx). */
export const page: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: calm },
};

/**
 * Props for something that reveals as it scrolls into view. It starts at 40 % opacity,
 * never at zero: content must never depend on the animation (a full-page screenshot, a
 * slow phone, a printout). Print shows it in full through [data-reveal] in globals.css.
 */
export function revealOnScroll(index: number, reduceMotion: boolean | null, gap = 0.06) {
  return {
    initial: reduceMotion ? false : { opacity: 0.4, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: DUR.calm, ease: EASE.calm, delay: reduceMotion ? 0 : index * gap },
    "data-reveal": "",
  } as const;
}

// The older names, now on Calm values, so screens not yet migrated move with the rest.
export const fadeUp = arrive;
export const fadeIn = swap;
export const stagger = reveal;
export const slideLeft: Variants = { hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: calm } };
export const slideRight: Variants = { hidden: { opacity: 0, x: 12 }, show: { opacity: 1, x: 0, transition: calm } };
export const cardHover = lift;
export const btnTap = { whileTap: press.whileTap };
