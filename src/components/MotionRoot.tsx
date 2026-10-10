"use client";
import { MotionConfig } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";

/**
 * One motion setting for the whole app: framer-motion follows the visitor's
 * "reduce motion" preference everywhere (movement off, fades kept), and anything without
 * its own transition uses Calm's default (plan §2.2).
 */
export default function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: DUR.calm, ease: EASE.calm }}>
      {children}
    </MotionConfig>
  );
}
