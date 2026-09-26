# Showcase 3/3 — Smart-ID page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/smart-id-demo` looks like a real Smart-ID login — country + personal code, SK's test people one tap away — and a simulated phone beside it plays the Smart-ID app in step with SK's real session, ending the way SK really answered.

**Architecture:** The SK connection (`/api/smart-id-demo`, `smart-id-demo.ts`) and badge saving stay as they are. New: a pure `phoneScreen()` that maps the page's phase and elapsed time to a phone screen; a presentational `SimulatedPhone`; a `SmartIdForm` that refuses anything but SK's test people before a request is made; `SmartIdDemo` rewired around them; and a tiny broadcast in `useProfile` so the sidebar's Smart-ID card flips to "verified" the moment the badge is saved.

**Tech Stack:** Next.js 16.2 (client components), React 19, Tailwind v4 tokens, lucide-react 1.17, vitest 4 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-showcase-collar-smartid-design.md` (section "Web — Smart-ID", failures table rows "Smart-ID"). Mockup: `docs/superpowers/specs/2026-09-26-showcase-mockups/smart-id.html`.

**Depends on:** plan 2 Task 9 (the sidebar's Smart-ID card reads `useProfile().profile.is_verified`) and plan 2 Task 3 (`formatClock` in `src/lib/collar/stats.ts`). Independent of the collar backend otherwise.

## Global Constraints

- The page stays at `/smart-id-demo`; `/api/smart-id-demo` and `src/lib/smart-id-demo.ts` keep their behaviour. The display text SK shows stays exactly `Prisijungimas prie PetBnB (demo)` (the signature check rebuilds it).
- Only SK's five Lithuanian test people exist (`TEST_IDENTITIES`); any other personal code is refused in the browser with fallback d and **no request is sent**.
- The phone is **simulated**, desktop only (`lg` and up), always captioned as simulated; the "DEMO · SK test environment" marker is always visible.
- No "How it works" box (Lukas: no technical explainer diagrams).
- The client still gives up after **90 s** (`CLIENT_TIMEOUT_MS`); the phone animation: notification for **1.2 s**, then one PIN dot every **0.4 s** (4 dots), then "confirming" until SK answers; an early answer skips to the ending.
- `appPages.smartIdDemo.subtitle` must keep mentioning the badge in both languages (`copy-facts.test.ts`).
- Git: explicit paths only; never `src/app/dev/` or `docs/security/`; commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Running the demo on prod saves a DEMO badge on the signed-in profile — that is Lukas's click, not an agent's.

## Review Focus

- **Someone types their own personal code** because the form now looks real: nothing may reach SK — pinned in Task 4 (`refuses a real personal code without calling SK`).
- **SK answers before the phone animation finishes** (the demo test person is fast): the phone must jump to the ending, not replay PIN dots after "Confirmed" — pinned in Task 1 (`an answer skips the animation`).
- **An SK error** (demo down): the phone must not pretend a request arrived — pinned in Task 1 (`errors leave the lock screen`).
- **Verifying while the sidebar is on screen**: the Smart-ID card must flip without a reload — pinned in Task 5 (`notifyProfileChanged`).
- **Pressing Cancel mid-session** must stop polling and return to the form — pinned in Task 5 (`cancel returns to the form`).

---

### Task 1: The phone script (`phoneScreen`)

**Files:**
- Create: `src/lib/smart-id-phone.ts`
- Modify: `src/lib/smart-id-demo-identities.ts` (export the display text), `src/lib/smart-id-demo.ts` (use it)
- Test: `src/lib/__tests__/smart-id-phone.test.ts`

**Interfaces:**
- Produces: `SMART_ID_DISPLAY_TEXT` (identities file, client-safe); `NOTIFICATION_MS = 1200`, `PIN_DIGIT_MS = 400`, `PIN_DIGITS = 4`; `PhonePhase`; `PhoneEnding = "confirmed" | "cancelled" | "wrong_code" | "expired"`; `PhoneScreen = {kind:"lock"} | {kind:"notification"} | {kind:"pin"; code; filled} | {kind:"confirming"; code} | {kind:"ending"; ending}`; `phoneScreen(phase, msSinceCode) → PhoneScreen`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/smart-id-phone.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { phoneScreen, NOTIFICATION_MS, PIN_DIGIT_MS } from "@/lib/smart-id-phone";

const waiting = { name: "waiting" as const, code: "4127" };

describe("phoneScreen", () => {
  it("shows the lock screen before a session starts", () => {
    expect(phoneScreen({ name: "idle" }, 0)).toEqual({ kind: "lock" });
    expect(phoneScreen({ name: "starting" }, 0)).toEqual({ kind: "lock" });
  });

  it("shows the notification the moment the code appears", () => {
    expect(phoneScreen(waiting, 0)).toEqual({ kind: "notification" });
    expect(phoneScreen(waiting, NOTIFICATION_MS - 1)).toEqual({ kind: "notification" });
  });

  it("opens the app with the same code and fills one PIN dot every 0.4 s", () => {
    expect(phoneScreen(waiting, NOTIFICATION_MS)).toEqual({ kind: "pin", code: "4127", filled: 0 });
    expect(phoneScreen(waiting, NOTIFICATION_MS + PIN_DIGIT_MS)).toEqual({ kind: "pin", code: "4127", filled: 1 });
    expect(phoneScreen(waiting, NOTIFICATION_MS + 3 * PIN_DIGIT_MS)).toEqual({ kind: "pin", code: "4127", filled: 3 });
  });

  it("waits on 'confirming' once the PIN is in, until SK answers", () => {
    expect(phoneScreen(waiting, NOTIFICATION_MS + 4 * PIN_DIGIT_MS)).toEqual({ kind: "confirming", code: "4127" });
    expect(phoneScreen(waiting, 60_000)).toEqual({ kind: "confirming", code: "4127" });
  });

  it.each([
    ["ok", "confirmed"],
    ["refused", "cancelled"],
    ["wrong_code", "wrong_code"],
    ["timeout", "expired"],
  ] as const)("ends %s as %s", (outcome, ending) => {
    expect(phoneScreen({ name: "done", outcome }, 0)).toEqual({ kind: "ending", ending });
  });

  it("an answer skips the animation, whenever it comes", () => {
    expect(phoneScreen({ name: "done", outcome: "ok" }, NOTIFICATION_MS + 1)).toEqual({ kind: "ending", ending: "confirmed" });
  });

  it("errors leave the lock screen: the phone never heard of the request", () => {
    expect(phoneScreen({ name: "done", outcome: "error" }, 5_000)).toEqual({ kind: "lock" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/__tests__/smart-id-phone.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Move the display text where the browser can import it**

In `src/lib/smart-id-demo-identities.ts`, add at the end:

```ts
/**
 * What the Smart-ID app shows while asking for PIN1 (SK allows 60 characters). Here, not in
 * smart-id-demo.ts, so the simulated phone can show the very same text without pulling
 * node:crypto into the browser. The server signs over it, so it must not change casually.
 */
export const SMART_ID_DISPLAY_TEXT = "Prisijungimas prie PetBnB (demo)";
```

In `src/lib/smart-id-demo.ts`, replace

```ts
/** What the Smart-ID app shows while asking for the PIN. SK allows at most 60 characters. */
const DISPLAY_TEXT = "Prisijungimas prie PetBnB (demo)";
```

with

```ts
import { SMART_ID_DISPLAY_TEXT } from "@/lib/smart-id-demo-identities";

/** What the Smart-ID app shows while asking for the PIN (see SMART_ID_DISPLAY_TEXT). */
const DISPLAY_TEXT = SMART_ID_DISPLAY_TEXT;
```

(move the new `import` up to sit with the file's other imports).

- [ ] **Step 4: Write `smart-id-phone.ts`**

```ts
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
```

- [ ] **Step 5: Run the phone tests and the Smart-ID library tests**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/__tests__/smart-id-phone.test.ts src/lib/__tests__/smart-id-demo.test.ts src/lib/__tests__/smart-id-demo-api.test.ts`
Expected: PASS (10 new phone tests) — and the signature test still verifies the saved SK session, because the display text is unchanged.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/smart-id-phone.ts src/lib/__tests__/smart-id-phone.test.ts src/lib/smart-id-demo-identities.ts src/lib/smart-id-demo.ts && git commit -F - <<'EOF'
Script the simulated Smart-ID phone from the page's real session phase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Smart-ID copy in English and Lithuanian

**Files:**
- Modify: `src/lib/i18n/en/appPages.ts`, `src/lib/i18n/lt/appPages.ts` (the `smartIdDemo` section)

**Interfaces:**
- Produces the keys Tasks 3–5 use: `appPages.smartIdDemo.{pageLabel, demoPill, title, subtitle, countryLabel, countries.{LT,LV,EE}, noTestPeople, personalCodeLabel, personalCodeHint, start, testPeople, finePrint, notTestPerson, codeFormat, timeLeft, cancel, phoneCaption, identities.*, phone.*}`; removes `back`, `chooseLabel`, `howTitle`, `howStep1`, `howStep2`, `howStep3`, `demoNote`.

- [ ] **Step 1: English**

In `src/lib/i18n/en/appPages.ts`, inside `smartIdDemo`:
- Delete the keys `back`, `chooseLabel`, `howTitle`, `howStep1`, `howStep2`, `howStep3`, `demoNote`.
- Replace `title`, `subtitle`, `identities` and `start` with:

```ts
    title: "Confirm who you are",
    subtitle: "Owners see a Smart-ID badge on your profile, so they know who they're leaving their pet with. It takes about a minute.",
    identities: {
      ok: "Confirms",
      refused: "Refuses",
      refusedPin: "Refuses at PIN",
      wrongCode: "Picks the wrong code",
      timeout: "Never answers",
    },
    start: "Continue with Smart-ID",
```

- Add after `start`:

```ts
    pageLabel: "Identity",
    demoPill: "DEMO · SK test environment",
    countryLabel: "Country",
    countries: { LT: "Lithuania", LV: "Latvia", EE: "Estonia" },
    noTestPeople: "no test people in this demo",
    personalCodeLabel: "Personal code",
    personalCodeHint: "11 digits, as on your ID card.",
    testPeople: "Test people · tap one to fill the code",
    finePrint: "SK's demo only knows these test people, so no real person is checked here. Only “verified” is saved to your profile; no name or personal code.",
    notTestPerson: "SK's demo only knows its test people, so a real personal code can't be checked here. Tap one of the test people below.",
    codeFormat: "A Lithuanian personal code has 11 digits.",
    timeLeft: "{time} left",
    cancel: "Cancel",
    phoneCaption: "Their phone · simulated",
    phone: {
      now: "now",
      tapToConfirm: "Tap to confirm with PIN1",
      requestFrom: "Log-in request from",
      verificationCode: "Verification code",
      enterPin: "Enter PIN1",
      confirming: "Confirming…",
      confirmed: "Confirmed",
      confirmedText: "You're logged in to PetBnB (demo). You can go back to the site.",
      cancelled: "Request cancelled",
      cancelledText: "You said no to PetBnB (demo).",
      wrongCode: "Wrong code",
      wrongCodeText: "The code you picked didn't match the site's. The request was stopped for your safety.",
      expired: "Request expired",
      done: "Done",
      close: "Close",
    },
```

- [ ] **Step 2: Lithuanian (same shape)**

In `src/lib/i18n/lt/appPages.ts`, inside `smartIdDemo`: delete the same seven keys, then:

```ts
    title: "Patvirtinkite, kas esate",
    subtitle: "Šeimininkai jūsų profilyje matys Smart-ID ženklelį ir žinos, kam patiki augintinį. Tai užtrunka apie minutę.",
    identities: {
      ok: "Patvirtina",
      refused: "Atsisako",
      refusedPin: "Atsisako įvesti PIN",
      wrongCode: "Pasirenka ne tą kodą",
      timeout: "Neatsako",
    },
    start: "Tęsti su Smart-ID",
    pageLabel: "Tapatybė",
    demoPill: "DEMO · SK testinė aplinka",
    countryLabel: "Šalis",
    countries: { LT: "Lietuva", LV: "Latvija", EE: "Estija" },
    noTestPeople: "šioje demonstracijoje testinių asmenų nėra",
    personalCodeLabel: "Asmens kodas",
    personalCodeHint: "11 skaitmenų, kaip asmens dokumente.",
    testPeople: "Testiniai asmenys · paspauskite, kad įrašytumėte kodą",
    finePrint: "SK demo aplinka žino tik šiuos testinius asmenis, todėl tikras asmuo čia netikrinamas. Jūsų profilyje išsaugoma tik žymė „patvirtinta“ – be vardo ir asmens kodo.",
    notTestPerson: "SK demo aplinka žino tik savo testinius asmenis, todėl tikro asmens kodo čia patikrinti negalima. Paspauskite vieną iš testinių asmenų žemiau.",
    codeFormat: "Lietuvos asmens kodą sudaro 11 skaitmenų.",
    timeLeft: "Liko {time}",
    cancel: "Atšaukti",
    phoneCaption: "Jų telefonas · imitacija",
    phone: {
      now: "dabar",
      tapToConfirm: "Palieskite ir patvirtinkite PIN1",
      requestFrom: "Prisijungimo užklausa iš",
      verificationCode: "Kontrolinis kodas",
      enterPin: "Įveskite PIN1",
      confirming: "Tvirtinama…",
      confirmed: "Patvirtinta",
      confirmedText: "Prisijungėte prie PetBnB (demo). Galite grįžti į svetainę.",
      cancelled: "Užklausa atšaukta",
      cancelledText: "Atsisakėte PetBnB (demo) užklausos.",
      wrongCode: "Neteisingas kodas",
      wrongCodeText: "Pasirinktas kodas nesutapo su svetainės. Dėl saugumo užklausa sustabdyta.",
      expired: "Užklausos laikas baigėsi",
      done: "Baigti",
      close: "Uždaryti",
    },
```

- [ ] **Step 3: Run the i18n tests**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/i18n`
Expected: PASS (parity; copy-facts still finds "badge" / "ženklel" in the subtitle). The old `SmartIdDemo.tsx` still references the deleted keys until Task 5 — it only renders them, so nothing fails; they show as raw keys in the meantime.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/i18n/en/appPages.ts src/lib/i18n/lt/appPages.ts && git commit -F - <<'EOF'
Rewrite the Smart-ID page copy for the real-looking form and phone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: `SimulatedPhone`

**Files:**
- Create: `src/components/SimulatedPhone.tsx`
- Test: `src/components/__tests__/SimulatedPhone.test.tsx`

**Interfaces:**
- Consumes: Task 1 `PhoneScreen`, `PIN_DIGITS`, `SMART_ID_DISPLAY_TEXT`; Task 2 keys.
- Produces: `<SimulatedPhone screen clock date />` (`clock` "14:05", `date` "Saturday, 26 September").

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/SimulatedPhone.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SimulatedPhone from "@/components/SimulatedPhone";
import type { PhoneScreen } from "@/lib/smart-id-phone";

const show = (s: PhoneScreen) => render(<SimulatedPhone screen={s} clock="14:05" date="Saturday, 26 September" />);

describe("SimulatedPhone", () => {
  it("is always captioned as simulated", () => {
    show({ kind: "lock" });
    expect(screen.getByText("appPages.smartIdDemo.phoneCaption")).toBeTruthy();
    expect(screen.getAllByText("14:05").length).toBeGreaterThan(0);
  });

  it("shows the notification with SK's display text", () => {
    show({ kind: "notification" });
    expect(screen.getByText("Prisijungimas prie PetBnB (demo)")).toBeTruthy();
    expect(screen.getByText("appPages.smartIdDemo.phone.tapToConfirm")).toBeTruthy();
  });

  it("shows the same code and fills the PIN dots", () => {
    const { container } = show({ kind: "pin", code: "4127", filled: 3 });
    expect(screen.getByText("4127")).toBeTruthy();
    expect(screen.getByText("appPages.smartIdDemo.phone.enterPin")).toBeTruthy();
    expect(container.querySelectorAll("[data-pin-dot='filled']")).toHaveLength(3);
    expect(container.querySelectorAll("[data-pin-dot]")).toHaveLength(4);
  });

  it("says confirming once the PIN is in", () => {
    show({ kind: "confirming", code: "4127" });
    expect(screen.getByText("appPages.smartIdDemo.phone.confirming")).toBeTruthy();
  });

  it.each([
    ["confirmed", "appPages.smartIdDemo.phone.confirmed"],
    ["cancelled", "appPages.smartIdDemo.phone.cancelled"],
    ["wrong_code", "appPages.smartIdDemo.phone.wrongCode"],
    ["expired", "appPages.smartIdDemo.phone.expired"],
  ] as const)("shows the %s ending", (ending, title) => {
    show({ kind: "ending", ending });
    expect(screen.getByText(title)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/__tests__/SimulatedPhone.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `SimulatedPhone.tsx`**

```tsx
"use client";
import { Check, Fingerprint, KeyRound, TriangleAlert, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { SMART_ID_DISPLAY_TEXT } from "@/lib/smart-id-demo-identities";
import { PIN_DIGITS, type PhoneEnding, type PhoneScreen } from "@/lib/smart-id-phone";
import { cn } from "@/lib/utils";

const LOCK_BACKGROUND =
  "radial-gradient(80% 45% at 25% 18%, rgb(96 170 200 / .55), transparent 70%), radial-gradient(70% 55% at 85% 95%, rgb(220 154 53 / .4), transparent 70%), linear-gradient(170deg, #1d3642, #0b161b)";

function AppIcon({ size = 30 }: { size?: number }) {
  return (
    <span className="grid flex-shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#1a86a8] to-[#0b4a60] text-white" style={{ width: size, height: size }}>
      <KeyRound className="h-[55%] w-[55%]" aria-hidden="true" />
    </span>
  );
}

const ENDING_STYLE: Record<Exclude<PhoneEnding, "expired">, { icon: typeof Check; tone: string; title: string; text: string; button: string }> = {
  confirmed: { icon: Check, tone: "bg-[#e1f3ea] text-[#177a50]", title: "confirmed", text: "confirmedText", button: "done" },
  cancelled: { icon: X, tone: "bg-[#f8e5e3] text-[#b8443a]", title: "cancelled", text: "cancelledText", button: "close" },
  wrong_code: { icon: TriangleAlert, tone: "bg-[#fcf0da] text-[#8a5c1f]", title: "wrongCode", text: "wrongCodeText", button: "close" },
};

/** "Their phone · simulated": the Smart-ID app screens a person would see, played for the audience. */
export default function SimulatedPhone({ screen, clock, date }: { screen: PhoneScreen; clock: string; date: string }) {
  const { t } = useLanguage();
  const k = (key: string) => t(`appPages.smartIdDemo.phone.${key}`);
  const onLock = screen.kind === "lock" || screen.kind === "notification" || (screen.kind === "ending" && screen.ending === "expired");

  return (
    <figure className="mx-auto w-[300px]">
      <div className="rounded-[46px] bg-[#0f1412] p-2.5 shadow-[0_12px_36px_rgb(0_0_0/0.28)] ring-2 ring-inset ring-[#2c3531]">
        <div
          data-screen={screen.kind}
          className={cn("relative h-[600px] overflow-hidden rounded-[38px]", onLock ? "text-white" : "bg-white text-[#10222b]")}
          style={onLock ? { background: LOCK_BACKGROUND } : undefined}
        >
          <span className="absolute left-1/2 top-2 z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
          <div className="flex h-10 items-center px-7 pt-1 text-[12px] font-semibold">{clock}</div>

          {onLock ? (
            <div>
              <p className="mt-6 text-center text-[64px] font-semibold leading-none tracking-tight">{clock}</p>
              <p className="mt-2 text-center text-[15px] font-medium opacity-85">{date}</p>
              {(screen.kind === "notification" || screen.kind === "ending") && (
                <div className={cn("mx-2.5 mt-7 flex gap-2.5 rounded-[20px] bg-white/25 px-3 py-2.5 backdrop-blur-xl", screen.kind === "ending" && "opacity-55")}>
                  <AppIcon size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-[12px] opacity-90">
                      <b>Smart-ID</b>
                      <span>{k("now")}</span>
                    </div>
                    {screen.kind === "ending" ? (
                      <>
                        <p className="text-[13.5px] font-semibold">{k("expired")}</p>
                        <p className="truncate text-[12.5px] opacity-85">{SMART_ID_DISPLAY_TEXT}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[13.5px] font-semibold">{SMART_ID_DISPLAY_TEXT}</p>
                        <p className="text-[12.5px] opacity-85">{k("tapToConfirm")}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex h-11 items-center gap-2.5 px-5">
                <AppIcon />
                <b className="text-[16px] font-bold tracking-tight">Smart-ID</b>
              </div>

              {screen.kind === "pin" || screen.kind === "confirming" ? (
                <>
                  <div className="px-6 pt-2 text-center">
                    <p className="text-[12.5px] text-[#5a6b73]">{k("requestFrom")}</p>
                    <p className="text-[19px] font-bold">PetBnB (demo)</p>
                    <p className="mt-2.5 rounded-xl bg-[#f1f5f7] px-3 py-2 text-[12.5px] text-[#2b3d45]">{SMART_ID_DISPLAY_TEXT}</p>
                    <p className="mt-4 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#5a6b73]">{k("verificationCode")}</p>
                    <p className="font-mono text-[40px] font-bold leading-tight tracking-[0.1em]">{screen.code}</p>
                    <p className="mt-2 text-[13.5px] font-semibold">{screen.kind === "pin" ? k("enterPin") : k("confirming")}</p>
                    <div className="mt-2 flex justify-center gap-3.5" aria-hidden="true">
                      {Array.from({ length: PIN_DIGITS }, (_, i) => {
                        const filled = screen.kind === "confirming" || i < screen.filled;
                        return (
                          <span key={i} data-pin-dot={filled ? "filled" : "empty"}
                            className={cn("h-3 w-3 rounded-full border-2 border-[#0b4a60]", filled && "bg-[#0b4a60]")} />
                        );
                      })}
                    </div>
                  </div>
                  {screen.kind === "pin" && (
                    <div className="absolute inset-x-0 bottom-5 grid grid-cols-3 gap-y-1.5 px-9" aria-hidden="true">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "OK"].map((key, i) => (
                        <span key={i} className={cn("grid h-[46px] w-[46px] place-items-center justify-self-center rounded-full text-[20px] font-medium", key === "" ? "" : key === "OK" ? "text-[13px] font-semibold text-[#0b4a60]" : "bg-[#eef2f4]")}>
                          {key}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : screen.kind === "ending" && screen.ending !== "expired" ? (
                (() => {
                  const style = ENDING_STYLE[screen.ending];
                  const Icon = style.icon;
                  return (
                    <>
                      <div className="absolute inset-x-0 top-36 px-7 text-center">
                        <span className={cn("mx-auto grid h-20 w-20 place-items-center rounded-full", style.tone)}>
                          <Icon className="h-10 w-10" strokeWidth={2.4} aria-hidden="true" />
                        </span>
                        <p className="mt-4 text-[22px] font-bold tracking-tight">{k(style.title)}</p>
                        <p className="mt-1.5 text-[13.5px] leading-snug text-[#5a6b73]">{k(style.text)}</p>
                      </div>
                      <span className="absolute inset-x-6 bottom-8 grid h-12 place-items-center rounded-2xl bg-[#0b4a60] text-[15px] font-semibold text-white">
                        {k(style.button)}
                      </span>
                    </>
                  );
                })()
              ) : null}
            </div>
          )}
        </div>
      </div>
      <figcaption className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
        <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
        {t("appPages.smartIdDemo.phoneCaption")}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/__tests__/SimulatedPhone.test.tsx && npm run typecheck`
Expected: PASS (8 tests); tsc 0.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/components/SimulatedPhone.tsx src/components/__tests__/SimulatedPhone.test.tsx && git commit -F - <<'EOF'
Add the simulated phone that plays the Smart-ID app screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: `SmartIdForm` — country, personal code, test people

**Files:**
- Create: `src/components/SmartIdForm.tsx`
- Test: `src/components/__tests__/SmartIdForm.test.tsx`

**Interfaces:**
- Consumes: `TEST_IDENTITIES`; Task 2 keys.
- Produces: `<SmartIdForm starting onStart />` — `onStart("PNOLT-<11 digits>")` only for a test person.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/SmartIdForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SmartIdForm from "@/components/SmartIdForm";

const code = () => screen.getByLabelText("appPages.smartIdDemo.personalCodeLabel") as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));

describe("SmartIdForm", () => {
  it("fills the code from a test person and starts with their identity", () => {
    const onStart = vi.fn();
    render(<SmartIdForm starting={false} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /identities\.wrongCode/ }));
    expect(code().value).toBe("30403039972");
    submit();
    expect(onStart).toHaveBeenCalledWith("PNOLT-30403039972");
  });

  it("accepts a test person's code typed by hand", () => {
    const onStart = vi.fn();
    render(<SmartIdForm starting={false} onStart={onStart} />);
    fireEvent.change(code(), { target: { value: "404 040 40009" } });
    expect(code().value).toBe("40404040009");
    submit();
    expect(onStart).toHaveBeenCalledWith("PNOLT-40404040009");
  });

  it("refuses a real personal code without calling SK", () => {
    const onStart = vi.fn();
    render(<SmartIdForm starting={false} onStart={onStart} />);
    fireEvent.change(code(), { target: { value: "38901011234" } });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("appPages.smartIdDemo.notTestPerson");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("asks for eleven digits", () => {
    const onStart = vi.fn();
    render(<SmartIdForm starting={false} onStart={onStart} />);
    fireEvent.change(code(), { target: { value: "3890101" } });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("appPages.smartIdDemo.codeFormat");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("offers Lithuania, with Latvia and Estonia listed but unavailable", () => {
    render(<SmartIdForm starting={false} onStart={() => {}} />);
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual(["LT", "LV", "EE"]);
    expect(options.map((o) => o.disabled)).toEqual([false, true, true]);
  });

  it("marks the chip whose code is in the field", () => {
    render(<SmartIdForm starting={false} onStart={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /identities\.ok/ }));
    expect(screen.getByRole("button", { name: /identities\.ok/ }).getAttribute("aria-pressed")).toBe("true");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/__tests__/SmartIdForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `SmartIdForm.tsx`**

```tsx
"use client";
import { useId, useState, type FormEvent } from "react";
import { Fingerprint, TriangleAlert } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { TEST_IDENTITIES } from "@/lib/smart-id-demo-identities";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  ok: "bg-brand",
  refused: "bg-danger",
  refusedPin: "bg-danger",
  wrongCode: "bg-amber",
  timeout: "bg-[#8a948f]",
};

/**
 * What a real Smart-ID login asks for: country and personal code. SK's demo only knows its five
 * Lithuanian test people, so any other code is refused here, before anything reaches SK — the
 * form looks real enough that someone will try their own.
 */
export default function SmartIdForm({ starting, onStart }: { starting: boolean; onStart: (identity: string) => void }) {
  const { t } = useLanguage();
  const countryId = useId();
  const codeId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<"format" | "notTest" | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{11}$/.test(code)) {
      setError("format");
      return;
    }
    const identity = `PNOLT-${code}`;
    if (!TEST_IDENTITIES.some((person) => person.id === identity)) {
      setError("notTest");
      return;
    }
    setError(null);
    onStart(identity);
  };

  return (
    <form onSubmit={submit} noValidate className="glass-panel rounded-[var(--radius-card)] border p-6 sm:p-7">
      <label htmlFor={countryId} className="block text-sm font-semibold text-ink">{t("appPages.smartIdDemo.countryLabel")}</label>
      <select id={countryId} defaultValue="LT" className="mt-1.5 h-12 w-full rounded-xl border border-ink/12 bg-white px-3.5 text-[15px] text-ink">
        <option value="LT">{t("appPages.smartIdDemo.countries.LT")}</option>
        <option value="LV" disabled>{t("appPages.smartIdDemo.countries.LV")} ({t("appPages.smartIdDemo.noTestPeople")})</option>
        <option value="EE" disabled>{t("appPages.smartIdDemo.countries.EE")} ({t("appPages.smartIdDemo.noTestPeople")})</option>
      </select>

      <label htmlFor={codeId} className="mt-4 block text-sm font-semibold text-ink">{t("appPages.smartIdDemo.personalCodeLabel")}</label>
      <input
        id={codeId}
        value={code}
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => {
          setCode(event.target.value.replace(/\D/g, "").slice(0, 11));
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${codeId}-hint`}
        className={cn(
          "mt-1.5 h-[52px] w-full rounded-xl border-[1.5px] bg-white px-3.5 font-mono text-lg tracking-[0.08em] text-ink focus:outline-none focus:ring-4",
          error ? "border-danger focus:ring-danger/15" : "border-ink/15 focus:border-brand focus:ring-brand/15",
        )}
      />
      <p id={`${codeId}-hint`} className="mt-1.5 text-xs text-ink-soft">{t("appPages.smartIdDemo.personalCodeHint")}</p>
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12.5px] leading-snug text-[#8e2f27]">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {t(error === "format" ? "appPages.smartIdDemo.codeFormat" : "appPages.smartIdDemo.notTestPerson")}
        </p>
      )}

      <button type="submit" disabled={starting}
        className="mt-4 inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60">
        {starting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            {t("appPages.smartIdDemo.starting")}
          </>
        ) : (
          <>
            <Fingerprint className="h-4 w-4" aria-hidden="true" />
            {t("appPages.smartIdDemo.start")}
          </>
        )}
      </button>

      <div className="mt-5 border-t border-dashed border-ink/15 pt-4">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="rounded-md bg-amber-soft px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-amber-strong">SK DEMO</span>
          <span className="text-xs text-ink-soft">{t("appPages.smartIdDemo.testPeople")}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TEST_IDENTITIES.map((person) => {
            const digits = person.id.replace("PNOLT-", "");
            const selected = code === digits;
            return (
              <button key={person.id} type="button" aria-pressed={selected}
                onClick={() => {
                  setCode(digits);
                  setError(null);
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium",
                  selected ? "border-brand bg-brand-softer text-brand-strong" : "border-ink/10 bg-white/80 text-ink hover:border-ink/20",
                )}>
                <span className={cn("h-[7px] w-[7px] rounded-full", DOT[person.key])} aria-hidden="true" />
                {t(`appPages.smartIdDemo.identities.${person.key}`)}{" "}
                <code className="hidden font-mono text-[11.5px] text-ink-soft sm:inline">{digits}</code>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-soft">{t("appPages.smartIdDemo.finePrint")}</p>
    </form>
  );
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/__tests__/SmartIdForm.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/components/SmartIdForm.tsx src/components/__tests__/SmartIdForm.test.tsx && git commit -F - <<'EOF'
Add a real-looking Smart-ID form that only lets SK's test people through

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Wire it together — `SmartIdDemo`, the page, and the sidebar flip

**Files:**
- Modify: `src/components/SmartIdDemo.tsx` (whole file below)
- Modify: `src/app/(app)/smart-id-demo/page.tsx` (whole file below)
- Modify: `src/hooks/useProfile.ts` (add `notifyProfileChanged`)
- Test: `src/components/__tests__/SmartIdDemo.test.tsx` (whole file below), `src/hooks/__tests__/useProfile.test.tsx` (one new test)

**Interfaces:**
- Consumes: Tasks 1, 3, 4; plan 2's `formatClock` (`src/lib/collar/stats.ts`).
- Produces: `notifyProfileChanged(): void` in `src/hooks/useProfile.ts` — every mounted `useProfile()` re-reads the profile.

- [ ] **Step 1: Rewrite the SmartIdDemo tests (they fail against today's component)**

Replace the whole of `src/components/__tests__/SmartIdDemo.test.tsx` with:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SmartIdDemo from "@/components/SmartIdDemo";

// jsdom has no IntersectionObserver, which next/link uses to prefetch; a plain anchor is enough here.
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

/**
 * The Smart-ID demo page's flow: pick a test person (or type their code), see the verification
 * code while the simulated phone plays along, then the outcome. /api/smart-id-demo is faked.
 * Rendered without a LanguageProvider, so labels are their translation keys.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeApi(...polls: unknown[]) {
  const calls: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    if (body.action === "start") return json({ sessionId: "s-1", rpChallenge: "RC", verificationCode: "7180" });
    const next = polls.shift();
    return next instanceof Response ? next : json(next ?? { state: "running" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

function startAs(person: "ok" | "refused" | "refusedPin" | "wrongCode" | "timeout" = "ok") {
  // Not followed by a letter, so "refused" does not also match "refusedPin".
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`identities\\.${person}(?![A-Za-z])`) }));
  fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
}

/** SK's session never finishes; each poll takes 20 ms, so the loop yields to the test's timers. */
function slowRunningApi() {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (body.action === "start") return json({ sessionId: "s-1", rpChallenge: "RC", verificationCode: "7180" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    return json({ state: "running" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const okPoll = {
  state: "complete",
  outcome: "ok",
  verification: {
    signatureValid: true,
    identity: { givenName: "OK", surname: "TEST", country: "LT", personalCode: "404••••••••" },
    certificateLevel: "QUALIFIED",
    issuer: "TEST of SK ID Solutions EID-Q 2024E",
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("SmartIdDemo", () => {
  it("shows the verification code, then the verified identity with a checked signature", async () => {
    const { calls } = fakeApi({ state: "running" }, okPoll);
    // A short pause, so the code is on screen long enough to be seen before SK answers.
    render(<SmartIdDemo codeDelayMs={100} />);
    startAs("ok");
    expect(await screen.findByText("7180")).toBeInTheDocument();
    expect(await screen.findByText("appPages.smartIdDemo.okTitle")).toBeInTheDocument();
    expect(screen.getByText("OK TEST")).toBeInTheDocument();
    expect(screen.getByText("404••••••••")).toBeInTheDocument();
    expect(screen.getByText("appPages.smartIdDemo.signatureValid")).toBeInTheDocument();
    expect(calls[0]).toEqual({ action: "start", identity: "PNOLT-40404040009" });
    expect(calls[1]).toEqual({ action: "poll", sessionId: "s-1", rpChallenge: "RC" });
  });

  it("starts with the test person the presenter picked", async () => {
    const { calls } = fakeApi({ state: "complete", outcome: "wrong_code" });
    render(<SmartIdDemo codeDelayMs={0} />);
    startAs("wrongCode");
    expect(await screen.findByText("appPages.smartIdDemo.wrongCodeTitle")).toBeInTheDocument();
    expect(calls[0]).toEqual({ action: "start", identity: "PNOLT-30403039972" });
  });

  it("never calls SK for a code that is not a test person", async () => {
    const { fetchMock } = fakeApi();
    render(<SmartIdDemo codeDelayMs={0} />);
    fireEvent.change(screen.getByLabelText("appPages.smartIdDemo.personalCodeLabel"), { target: { value: "38901011234" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(screen.getByRole("alert").textContent).toBe("appPages.smartIdDemo.notTestPerson");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["refused", "appPages.smartIdDemo.refusedTitle"],
    ["timeout", "appPages.smartIdDemo.timeoutTitle"],
    ["error", "appPages.smartIdDemo.errorTitle"],
  ])("explains a %s outcome and offers to try again", async (outcome, title) => {
    fakeApi({ state: "complete", outcome });
    render(<SmartIdDemo codeDelayMs={0} />);
    startAs("ok");
    expect(await screen.findByText(title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.again" }));
    expect(screen.getByRole("button", { name: "appPages.smartIdDemo.start" })).toBeInTheDocument();
  });

  it("shows the error state when the service cannot be reached", async () => {
    fakeApi(json({ error: "provider" }, 502));
    render(<SmartIdDemo codeDelayMs={0} />);
    startAs("ok");
    expect(await screen.findByText("appPages.smartIdDemo.errorTitle")).toBeInTheDocument();
  });

  it("cancel returns to the form and stops polling", async () => {
    const fetchMock = slowRunningApi();
    render(<SmartIdDemo codeDelayMs={0} />);
    startAs("ok");
    expect(await screen.findByText("7180")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.cancel" }));
    expect(screen.getByRole("button", { name: "appPages.smartIdDemo.start" })).toBeInTheDocument();
    const callsAtCancel = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    // At most the one poll already in flight when Cancel was pressed.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(callsAtCancel + 1);
  });

  it("plays the phone's ending to match SK's answer", async () => {
    fakeApi(okPoll);
    const { container } = render(<SmartIdDemo codeDelayMs={0} />);
    startAs("ok");
    await screen.findByText("appPages.smartIdDemo.okTitle");
    expect(container.querySelector("[data-screen='ending']")).not.toBeNull();
    expect(screen.getByText("appPages.smartIdDemo.phone.confirmed")).toBeInTheDocument();
  });
});

describe("saving the badge", () => {
  it("saves the verification after an OK result and says the badge was added", async () => {
    fakeApi(okPoll);
    const saveVerification = vi.fn(async () => "verified" as const);
    const onVerified = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={saveVerification} onVerified={onVerified} />);
    startAs("ok");
    expect(await screen.findByText("appPages.smartIdDemo.badgeSaved")).toBeInTheDocument();
    expect(saveVerification).toHaveBeenCalledWith("s-1");
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
  });

  it.each([
    ["not_verified", "appPages.smartIdDemo.badgeNotVerified"],
    ["signed_out", "appPages.smartIdDemo.badgeSignedOut"],
    ["error", "appPages.smartIdDemo.badgeError"],
  ] as const)("explains a %s save", async (result, message) => {
    fakeApi(okPoll);
    const onVerified = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={async () => result} onVerified={onVerified} />);
    startAs("ok");
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("does not try to save a refusal", async () => {
    fakeApi({ state: "complete", outcome: "refused" });
    const saveVerification = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={saveVerification} />);
    startAs("refused");
    expect(await screen.findByText("appPages.smartIdDemo.refusedTitle")).toBeInTheDocument();
    expect(saveVerification).not.toHaveBeenCalled();
  });
});
```

Add to `src/hooks/__tests__/useProfile.test.tsx` — change its import to `import { useProfile, notifyProfileChanged } from "@/hooks/useProfile";` and append:

```tsx
describe("notifyProfileChanged", () => {
  it("makes every mounted useProfile read the profile again (the sidebar after a badge is saved)", async () => {
    h.auth.user = userA;
    h.auth.loading = false;
    h.maybeSingle.mockResolvedValue({ data: makeProfile(), error: null });
    const first = renderHook(() => useProfile());
    const second = renderHook(() => useProfile());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    h.maybeSingle.mockResolvedValue({ data: makeProfile({ is_verified: true }), error: null });
    await act(async () => {
      notifyProfileChanged();
    });
    await waitFor(() => expect(first.result.current.profile?.is_verified).toBe(true));
    expect(second.result.current.profile?.is_verified).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/__tests__/SmartIdDemo.test.tsx src/hooks/__tests__/useProfile.test.tsx`
Expected: FAIL — no chips (today's component has radios), no `notifyProfileChanged` export.

- [ ] **Step 3: Add `notifyProfileChanged` to `useProfile.ts`**

Replace the whole of `src/hooks/useProfile.ts` with:

```ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Database } from "@/lib/supabase";

type Profile = Database["public"]["Views"]["my_profile"]["Row"];

const listeners = new Set<() => void>();

/**
 * Every mounted useProfile() reads the profile again. Each component holds its own copy, so
 * without this the sidebar's Smart-ID card stayed "not verified" until a reload after the badge
 * was saved on the Smart-ID page.
 */
export function notifyProfileChanged(): void {
  for (const listener of listeners) listener();
}

/**
 * Own profile, read through the `my_profile` view rather than the profiles table.
 *
 * `authenticated` holds a SELECT grant on only the public columns of profiles, so
 * `select("*")` there is an error and `phone` is not among the columns it can name.
 * The view is `where id = auth.uid()`, which is the one place a phone number is
 * legitimately readable: your own.
 */
export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    supabase
      .from("my_profile")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [user, authLoading]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("my_profile").select("*").maybeSingle();
    setProfile(data);
  }, [user]);

  useEffect(() => {
    const listener = () => void refresh();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [refresh]);

  const isComplete = !!(profile?.full_name && profile?.phone && profile?.city);

  return { profile, loading: loading || authLoading, isComplete, refresh };
}
```

(Compare with the current file before replacing: only `useCallback` on `refresh`, the listener set, the effect and `notifyProfileChanged` are new; if the current file differs elsewhere, keep its version of those parts.)

- [ ] **Step 4: Rewrite `SmartIdDemo.tsx`**

Replace the whole of `src/components/SmartIdDemo.tsx` with:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Ban, Clock, ShieldAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import type { DemoOutcome } from "@/lib/smart-id-demo-identities";
import { saveDemoVerification, type SaveResult } from "@/lib/smart-id-demo-save";
import { phoneScreen } from "@/lib/smart-id-phone";
import { formatClock } from "@/lib/collar/stats";
import { cn } from "@/lib/utils";
import SmartIdForm from "@/components/SmartIdForm";
import SimulatedPhone from "@/components/SimulatedPhone";

/**
 * The Smart-ID demo flow (redesigned 2026-09-26): a real-looking form (country + personal code,
 * SK's test people one tap away), the verification code while SK's session runs, then the outcome
 * — with a simulated phone beside it playing what the person would see. The server checks SK's
 * signature and reads the identity from the certificate; a verified result saves a DEMO badge.
 */

interface Verification {
  signatureValid: boolean;
  identity: { givenName: string; surname: string; country: string; personalCode: string } | null;
  certificateLevel: string | null;
  issuer: string | null;
}

type Phase =
  | { name: "idle" }
  | { name: "starting" }
  | { name: "waiting"; code: string }
  | { name: "done"; outcome: DemoOutcome; verification?: Verification; save?: SaveResult | "saving" };

/** The client gives up after this long, whatever SK is doing. */
const CLIENT_TIMEOUT_MS = 90_000;

const OUTCOME_KEYS: Record<Exclude<DemoOutcome, "ok">, { title: string; text: string; icon: typeof Ban }> = {
  refused: { title: "refusedTitle", text: "refusedText", icon: Ban },
  wrong_code: { title: "wrongCodeTitle", text: "wrongCodeText", icon: ShieldAlert },
  timeout: { title: "timeoutTitle", text: "timeoutText", icon: Clock },
  error: { title: "errorTitle", text: "errorText", icon: TriangleAlert },
};

const SAVE_KEYS: Record<SaveResult, string> = {
  verified: "badgeSaved",
  not_verified: "badgeNotVerified",
  signed_out: "badgeSignedOut",
  error: "badgeError",
};

async function callApi(body: Record<string, string>, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch("/api/smart-id-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function SmartIdDemo({
  codeDelayMs = 2000,
  saveVerification = saveDemoVerification,
  onVerified,
}: {
  codeDelayMs?: number;
  /** Saves a successful demo on the signed-in profile; injectable for tests. */
  saveVerification?: (sessionId: string) => Promise<SaveResult>;
  /** Called once the badge is saved, so the app can refresh the profile everywhere. */
  onVerified?: () => void;
}) {
  const { t, locale } = useLanguage();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [codeAt, setCodeAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // The phone animates and the countdown runs while SK's session is open; otherwise the phone's
  // clock only needs to move once in a while.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), phase.name === "waiting" ? 200 : 30_000);
    return () => clearInterval(timer);
  }, [phase.name]);

  const run = async (identity: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    const finish = (next: Phase) => { if (!signal.aborted) setPhase(next); };

    setPhase({ name: "starting" });
    const started = await callApi({ action: "start", identity }, signal);
    if (!started || typeof started.sessionId !== "string" || typeof started.rpChallenge !== "string") {
      finish({ name: "done", outcome: "error" });
      return;
    }
    if (signal.aborted) return;
    setCodeAt(Date.now());
    setNow(Date.now());
    finish({ name: "waiting", code: String(started.verificationCode) });

    // SK advises showing the code before the phone asks for the PIN, so it can be compared.
    if (codeDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, codeDelayMs));

    const deadline = Date.now() + CLIENT_TIMEOUT_MS;
    while (!signal.aborted && Date.now() < deadline) {
      const polled = await callApi({ action: "poll", sessionId: started.sessionId, rpChallenge: started.rpChallenge }, signal);
      if (signal.aborted) return;
      if (!polled) { finish({ name: "done", outcome: "error" }); return; }
      if (polled.state === "complete") {
        const outcome = polled.outcome as DemoOutcome;
        const verification = polled.verification as Verification | undefined;
        if (outcome !== "ok") { finish({ name: "done", outcome, verification }); return; }
        // A verified demo is saved on the profile: the database re-checks the session with SK.
        finish({ name: "done", outcome, verification, save: "saving" });
        const save = await saveVerification(started.sessionId);
        finish({ name: "done", outcome, verification, save });
        if (save === "verified" && !signal.aborted) onVerified?.();
        return;
      }
    }
    finish({ name: "done", outcome: "timeout" });
  };

  const reset = () => { abortRef.current?.abort(); setPhase({ name: "idle" }); };

  const secondsLeft = Math.max(0, Math.ceil((codeAt + CLIENT_TIMEOUT_MS - now) / 1000));
  const phoneDate = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(now));
  const panel = "glass-panel border rounded-[var(--radius-card)] p-6 sm:p-7";

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section>
        {phase.name === "idle" || phase.name === "starting" ? (
          <SmartIdForm starting={phase.name === "starting"} onStart={(identity) => void run(identity)} />
        ) : phase.name === "waiting" ? (
          <div className={cn(panel, "text-center")} aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.smartIdDemo.codeLabel")}</p>
            <p className="mt-2 font-display text-6xl font-semibold tabular-nums tracking-[0.12em] text-ink">{phase.code}</p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-ink-soft">{t("appPages.smartIdDemo.codeHint")}</p>
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden="true" />
              {t("appPages.smartIdDemo.waiting")}
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              {t("appPages.smartIdDemo.timeLeft", { time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` })}
            </p>
            <button type="button" onClick={reset}
              className="mt-5 h-11 w-full rounded-[var(--radius-input)] border border-black/10 bg-surface/70 px-6 text-sm font-semibold text-ink transition-colors hover:bg-surface sm:w-auto">
              {t("appPages.smartIdDemo.cancel")}
            </button>
          </div>
        ) : phase.outcome === "ok" && phase.verification?.identity ? (
          <div className={panel} aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
                <BadgeCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{t("appPages.smartIdDemo.okTitle")}</h2>
            </div>
            <dl className="mt-5 divide-y divide-black/5 text-sm">
              {[
                ["name", `${phase.verification.identity.givenName} ${phase.verification.identity.surname}`],
                ["country", phase.verification.identity.country],
                ["personalCode", phase.verification.identity.personalCode],
                ["certificate", [phase.verification.certificateLevel, phase.verification.issuer].filter(Boolean).join(" · ")],
              ].map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-soft">{t(`appPages.smartIdDemo.${key}`)}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-ink-soft">{t("appPages.smartIdDemo.signature")}</dt>
                <dd className="text-right font-medium text-brand-strong">{t("appPages.smartIdDemo.signatureValid")}</dd>
              </div>
            </dl>
            {phase.save && (
              <p role="status"
                className={cn(
                  "mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3.5 py-2.5 text-sm",
                  phase.save === "verified" ? "bg-brand-soft text-brand-strong" : phase.save === "saving" ? "bg-surface-2 text-ink-soft" : "bg-amber-soft text-amber-strong",
                )}>
                {phase.save === "saving" ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                    {t("appPages.smartIdDemo.savingBadge")}
                  </>
                ) : (
                  <>
                    <span>{t(`appPages.smartIdDemo.${SAVE_KEYS[phase.save]}`)}</span>
                    {phase.save === "verified" && (
                      <Link href="/profile" className="font-semibold underline underline-offset-2">{t("appPages.smartIdDemo.viewProfile")}</Link>
                    )}
                  </>
                )}
              </p>
            )}
            <button type="button" onClick={reset}
              className="mt-5 h-11 rounded-[var(--radius-input)] border border-black/10 bg-surface/70 px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface">
              {t("appPages.smartIdDemo.again")}
            </button>
          </div>
        ) : (
          (() => {
            const keys = OUTCOME_KEYS[phase.outcome === "ok" ? "error" : phase.outcome] ?? OUTCOME_KEYS.error;
            const Icon = keys.icon;
            return (
              <div className={panel} aria-live="polite">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-soft text-amber-strong">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{t(`appPages.smartIdDemo.${keys.title}`)}</h2>
                </div>
                <p className="mt-3 text-sm text-ink-soft">{t(`appPages.smartIdDemo.${keys.text}`)}</p>
                <button type="button" onClick={reset}
                  className="mt-5 h-11 rounded-[var(--radius-input)] border border-black/10 bg-surface/70 px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface">
                  {t("appPages.smartIdDemo.again")}
                </button>
              </div>
            );
          })()
        )}
      </section>

      <div className="hidden lg:block">
        <SimulatedPhone
          screen={phoneScreen(phase, now - codeAt)}
          clock={formatClock(new Date(now).toISOString(), locale)}
          date={phoneDate}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite the page**

Replace the whole of `src/app/(app)/smart-id-demo/page.tsx` with:

```tsx
"use client";
import SmartIdDemo from "@/components/SmartIdDemo";
import { useLanguage } from "@/context/LanguageContext";
import { notifyProfileChanged } from "@/hooks/useProfile";

/**
 * Smart-ID identity verification against SK's demo environment, made to look like the real login
 * (Lukas, 2026-09-26). Reached from the sidebar's Smart-ID card; saving the badge refreshes every
 * profile reader, so that card flips to "verified" at once.
 */
export default function SmartIdDemoPage() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.smartIdDemo.pageLabel")}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{t("appPages.smartIdDemo.title")}</h1>
        <span className="rounded-md bg-amber-soft px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-strong">
          {t("appPages.smartIdDemo.demoPill")}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft sm:text-base">{t("appPages.smartIdDemo.subtitle")}</p>
      <div className="mt-8">
        <SmartIdDemo onVerified={notifyProfileChanged} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/__tests__/SmartIdDemo.test.tsx src/hooks/__tests__/useProfile.test.tsx && npm test && npm run typecheck`
Expected: PASS; full suite green; tsc 0.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/components/SmartIdDemo.tsx "src/app/(app)/smart-id-demo/page.tsx" src/hooks/useProfile.ts src/components/__tests__/SmartIdDemo.test.tsx src/hooks/__tests__/useProfile.test.tsx && git commit -F - <<'EOF'
Make the Smart-ID page look like the real login, with the phone beside it

Country and personal code with SK's test people one tap away, the code
and a countdown while SK's session runs, and a simulated phone that ends
the way SK answered. Saving the badge now refreshes every profile reader,
so the sidebar's Smart-ID card flips to verified without a reload. The
identity radio list and the "How it works" box are gone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: See it, then try all five test people on prod

**Files:**
- Use (never commit): `src/app/dev/smart-id/page.tsx` (exists)

- [ ] **Step 1: Look at it at 1280 and 390 px, EN and LT**

`npm run dev`, then with the Chrome DevTools MCP tools open `http://localhost:3000/dev/smart-id` at 1280×800 and 390×844, in EN and LT. Compare against `docs/superpowers/specs/2026-09-26-showcase-mockups/smart-id.html`: the form, the chips (codes hidden below `sm`), the phone only at `lg`+, the phone's screens during a run with each test person (the sandbox talks to SK's real demo). Fix and commit anything off (never the sandbox file).

- [ ] **Step 2: Everything green**

Run: `cd C:/Users/lkspe/petbnb && npm test && npm run typecheck && npm run build`
Expected: all green. Record the count.

- [ ] **Step 3: On prod, after release (Lukas clicks; it saves his DEMO badge)**

Once plan 2 Task 15 has pushed to `main` (or with Lukas's yes to push this branch): signed in on https://petbnb.lt → sidebar → Smart-ID → run each test person: **Confirms** (phone: Confirmed; page: verified; sidebar card flips to "Identity verified · DEMO"), **Refuses**, **Refuses at PIN**, **Picks the wrong code**, **Never answers** (expires after 90 s). Type a real-looking code once: the alert appears and nothing is sent. Record every outcome in the checkpoint.
