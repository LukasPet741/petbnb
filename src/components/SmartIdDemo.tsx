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
