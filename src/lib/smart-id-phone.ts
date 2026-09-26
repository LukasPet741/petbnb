import type { DemoOutcome } from "@/lib/smart-id-demo-identities";

/**
 * The simulated phone beside the Smart-ID form (Lukas, 2026-09-26). SK's test people answer on
 * their own, so no real phone is involved; this plays what a person would see, in step with the
 * page's real session: the notification when SK's session starts, the app with the same code and
 * PIN1, "confirming" until SK answers, then the ending that matches SK's actual answer.
 */

export const NOTIFICATION_MS = 1200;
export const PIN_DIGIT_MS = 400;
export const PIN_DIGITS = 4;

export type PhonePhase =
  | { name: "idle" }
  | { name: "starting" }
  | { name: "waiting"; code: string }
  | { name: "done"; outcome: DemoOutcome };

export type PhoneEnding = "confirmed" | "cancelled" | "wrong_code" | "expired";

export type PhoneScreen =
  | { kind: "lock" }
  | { kind: "notification" }
  | { kind: "pin"; code: string; filled: number }
  | { kind: "confirming"; code: string }
  | { kind: "ending"; ending: PhoneEnding };

const ENDINGS: Partial<Record<DemoOutcome, PhoneEnding>> = {
  ok: "confirmed",
  refused: "cancelled",
  wrong_code: "wrong_code",
  timeout: "expired",
};

export function phoneScreen(phase: PhonePhase, msSinceCode: number): PhoneScreen {
  if (phase.name === "idle" || phase.name === "starting") return { kind: "lock" };
  if (phase.name === "done") {
    const ending = ENDINGS[phase.outcome];
    return ending ? { kind: "ending", ending } : { kind: "lock" };
  }
  if (msSinceCode < NOTIFICATION_MS) return { kind: "notification" };
  const filled = Math.floor((msSinceCode - NOTIFICATION_MS) / PIN_DIGIT_MS);
  if (filled < PIN_DIGITS) return { kind: "pin", code: phase.code, filled };
  return { kind: "confirming", code: phase.code };
}
