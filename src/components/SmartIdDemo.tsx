"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Ban, Clock, Fingerprint, KeyRound, ShieldAlert, TriangleAlert } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { TEST_IDENTITIES, type DemoOutcome } from "@/lib/smart-id-demo-identities";
import { cn } from "@/lib/utils";

/**
 * The Smart-ID demo flow (option B, 2026-09-15): pick one of SK's test identities, show the
 * verification code, poll /api/smart-id-demo until SK answers, show the outcome. Nothing is
 * stored; the server checks SK's signature and reads the identity from the certificate.
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
  | { name: "done"; outcome: DemoOutcome; verification?: Verification };

/** The client gives up after this long, whatever SK is doing. */
const CLIENT_TIMEOUT_MS = 90_000;

const OUTCOME_KEYS: Record<Exclude<DemoOutcome, "ok">, { title: string; text: string; icon: typeof Ban }> = {
  refused: { title: "refusedTitle", text: "refusedText", icon: Ban },
  wrong_code: { title: "wrongCodeTitle", text: "wrongCodeText", icon: ShieldAlert },
  timeout: { title: "timeoutTitle", text: "timeoutText", icon: Clock },
  error: { title: "errorTitle", text: "errorText", icon: TriangleAlert },
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

export default function SmartIdDemo({ codeDelayMs = 2000 }: { codeDelayMs?: number }) {
  const { t } = useLanguage();
  const [identity, setIdentity] = useState(TEST_IDENTITIES[0].id);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
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
    finish({ name: "waiting", code: String(started.verificationCode) });

    // SK advises showing the code before the phone asks for the PIN, so it can be compared.
    if (codeDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, codeDelayMs));

    const deadline = Date.now() + CLIENT_TIMEOUT_MS;
    while (!signal.aborted && Date.now() < deadline) {
      const polled = await callApi({ action: "poll", sessionId: started.sessionId, rpChallenge: started.rpChallenge }, signal);
      if (!polled) { finish({ name: "done", outcome: "error" }); return; }
      if (polled.state === "complete") {
        finish({ name: "done", outcome: polled.outcome as DemoOutcome, verification: polled.verification as Verification | undefined });
        return;
      }
    }
    finish({ name: "done", outcome: "timeout" });
  };

  const reset = () => { abortRef.current?.abort(); setPhase({ name: "idle" }); };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] items-start">
      <section className="glass-panel border rounded-[var(--radius-card)] p-6 sm:p-7">
        {phase.name === "idle" || phase.name === "starting" ? (
          <>
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink mb-3">
              <KeyRound className="w-4 h-4 text-brand" aria-hidden="true" />
              {t("appPages.smartIdDemo.chooseLabel")}
            </h2>
            <div role="radiogroup" className="grid gap-2">
              {TEST_IDENTITIES.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-[var(--radius-input)] border cursor-pointer text-sm transition-all",
                    identity === item.id ? "border-brand bg-brand-soft text-brand-strong" : "border-black/10 bg-surface/70 text-ink hover:border-black/20",
                  )}
                >
                  <input type="radio" name="smart-id-identity" checked={identity === item.id} onChange={() => setIdentity(item.id)} className="accent-[var(--color-brand)]" />
                  <span className="flex-1 font-medium">{t(`appPages.smartIdDemo.identities.${item.key}`)}</span>
                  <span className="font-mono text-xs text-ink-soft">{item.id}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void run()}
              disabled={phase.name === "starting"}
              className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-[var(--radius-input)] bg-brand text-white text-sm font-semibold hover:bg-brand-strong transition-colors disabled:opacity-60"
            >
              {phase.name === "starting" ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  {t("appPages.smartIdDemo.starting")}
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" aria-hidden="true" />
                  {t("appPages.smartIdDemo.start")}
                </>
              )}
            </button>
          </>
        ) : phase.name === "waiting" ? (
          <div className="text-center py-4" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.smartIdDemo.codeLabel")}</p>
            <p className="mt-2 font-display text-6xl font-semibold tracking-[0.12em] text-ink tabular-nums">{phase.code}</p>
            <p className="mt-3 text-sm text-ink-soft max-w-sm mx-auto">{t("appPages.smartIdDemo.codeHint")}</p>
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand">
              <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              {t("appPages.smartIdDemo.waiting")}
            </p>
          </div>
        ) : phase.outcome === "ok" && phase.verification?.identity ? (
          <div aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
                <BadgeCheck className="w-6 h-6" aria-hidden="true" />
              </span>
              <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">{t("appPages.smartIdDemo.okTitle")}</h2>
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
                  <dd className="text-ink font-medium text-right">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-ink-soft">{t("appPages.smartIdDemo.signature")}</dt>
                <dd className="text-brand-strong font-medium text-right">{t("appPages.smartIdDemo.signatureValid")}</dd>
              </div>
            </dl>
            <button type="button" onClick={reset} className="mt-5 h-11 px-5 rounded-[var(--radius-input)] border border-black/10 bg-surface/70 text-sm font-semibold text-ink hover:bg-surface transition-colors">
              {t("appPages.smartIdDemo.again")}
            </button>
          </div>
        ) : (
          (() => {
            const keys = OUTCOME_KEYS[phase.outcome === "ok" ? "error" : phase.outcome] ?? OUTCOME_KEYS.error;
            const Icon = keys.icon;
            return (
              <div aria-live="polite">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-soft text-amber-strong">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </span>
                  <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">{t(`appPages.smartIdDemo.${keys.title}`)}</h2>
                </div>
                <p className="mt-3 text-sm text-ink-soft">{t(`appPages.smartIdDemo.${keys.text}`)}</p>
                <button type="button" onClick={reset} className="mt-5 h-11 px-5 rounded-[var(--radius-input)] border border-black/10 bg-surface/70 text-sm font-semibold text-ink hover:bg-surface transition-colors">
                  {t("appPages.smartIdDemo.again")}
                </button>
              </div>
            );
          })()
        )}
      </section>

      <aside className="glass-card border rounded-[var(--radius-card)] p-5 text-sm">
        <h2 className="font-display text-base font-semibold text-ink tracking-tight">{t("appPages.smartIdDemo.howTitle")}</h2>
        <ol className="mt-3 space-y-2.5 list-decimal pl-4 text-ink-soft">
          <li>{t("appPages.smartIdDemo.howStep1")}</li>
          <li>{t("appPages.smartIdDemo.howStep2")}</li>
          <li>{t("appPages.smartIdDemo.howStep3")}</li>
        </ol>
        <p className="mt-4 pt-4 border-t border-black/5 text-xs text-ink-soft">{t("appPages.smartIdDemo.demoNote")}</p>
      </aside>
    </div>
  );
}
