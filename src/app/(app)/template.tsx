"use client";
import { motion } from "framer-motion";
import { page } from "@/lib/motion";

/**
 * Every signed-in page arrives the same way (Calm, plan §2.2): a template remounts on
 * each navigation, so the new page fades in and rises 8 px while the shell (sidebar,
 * tab bar) stays put. Reduced motion keeps only the fade (MotionRoot).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={page} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}
