/**
 * SK's Lithuanian test identities for the Smart-ID DEMO environment, one per outcome worth
 * showing (sk-eid.github.io/smart-id-documentation/test_accounts.html). Kept apart from
 * smart-id-demo.ts so the page can list them without pulling node:crypto into the browser.
 */

export type DemoOutcome = "ok" | "refused" | "wrong_code" | "timeout" | "error";

export const TEST_IDENTITIES: { id: string; outcome: Exclude<DemoOutcome, "error">; key: string }[] = [
  { id: "PNOLT-40404040009", outcome: "ok", key: "ok" },
  { id: "PNOLT-30403039917", outcome: "refused", key: "refused" },
  { id: "PNOLT-30403039928", outcome: "refused", key: "refusedPin" },
  { id: "PNOLT-30403039972", outcome: "wrong_code", key: "wrongCode" },
  { id: "PNOLT-30403039983", outcome: "timeout", key: "timeout" },
];

/**
 * What the Smart-ID app shows while asking for PIN1 (SK allows 60 characters). Here, not in
 * smart-id-demo.ts, so the simulated phone can show the very same text without pulling
 * node:crypto into the browser. The server signs over it, so it must not change casually.
 */
export const SMART_ID_DISPLAY_TEXT = "Prisijungimas prie PetBnB (demo)";
