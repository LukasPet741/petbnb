"use client";
import { Fragment, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCollarLive } from "@/context/CollarLiveContext";
import { useLanguage } from "@/context/LanguageContext";
import { loadPetNames } from "@/lib/collar/api";
import { cleanPairCode, formatPairCode, isPairCode, PAIR_CODE_LENGTH } from "@/lib/collar/pairCode";
import { cn } from "@/lib/utils";
import CollarArt from "./CollarArt";
import ConnectChecklist from "./ConnectChecklist";

type Step = 1 | 2 | 3 | 4;
type CodeError = "notFound" | "taken" | "network" | null;

/**
 * Pairing, as approved (2026-09-26): switch it on → the sticker code → who wears it → watch it
 * check in. A dialog on desktop, a sheet from the bottom on phones.
 */
export default function PairingWizard({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const live = useCollarLive();
  const [step, setStep] = useState<Step>(1);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<CodeError>(null);
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pets, setPets] = useState<string[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (step !== 3 || !user) return;
    let active = true;
    loadPetNames(user.id)
      .then((names) => {
        if (!active) return;
        setPets(names);
        setName((current) => current || names[0] || "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [step, user]);

  const submitCode = async () => {
    if (!isPairCode(code) || busy) return;
    setBusy(true);
    setCodeError(null);
    try {
      const result = await live.pair(code);
      if (result.result === "not_found") setCodeError("notFound");
      else if (result.result === "taken") setCodeError("taken");
      else {
        setDeviceId(result.deviceId);
        setStep(3);
      }
    } catch {
      setCodeError("network");
    } finally {
      setBusy(false);
    }
  };

  const submitName = async () => {
    setBusy(true);
    try {
      if (deviceId && name.trim()) await live.rename(deviceId, name.trim());
    } catch {
      // The name can be changed later from the menu; never block tracking on it.
    } finally {
      setBusy(false);
      setStep(4);
    }
  };

  const playInstead = async () => {
    await live.startReplay();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 glass-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={t("appPages.collar.empty.pair")}
        className="relative w-full rounded-t-3xl bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-lg)] sm:max-w-sm sm:rounded-2xl sm:p-6">
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-ink/15 sm:hidden" aria-hidden="true" />
        <button type="button" onClick={onClose} aria-label={t("appPages.collar.wizard.close")}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:text-ink">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="mb-3.5 flex items-center gap-2.5 pr-8">
          <span className="whitespace-nowrap text-[11px] font-semibold text-ink-soft">{t("appPages.collar.wizard.step", { step })}</span>
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-brand" : "bg-surface-2")} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div>
            <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">{t("appPages.collar.wizard.on.title")}</h2>
            <CollarArt className="my-3 h-[104px] w-full rounded-2xl bg-gradient-to-br from-brand-softer to-white" />
            <p className="text-[13px] text-ink-soft">{t("appPages.collar.wizard.on.text")}</p>
            <button type="button" onClick={() => setStep(2)} className="mt-4 h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white">
              {t("appPages.collar.wizard.on.next")}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">{t("appPages.collar.wizard.code.title")}</h2>
            <p className="mt-1 text-[13px] text-ink-soft">{t("appPages.collar.wizard.code.text")}</p>
            <label className="relative mt-4 block cursor-text">
              <span className="sr-only">{t("appPages.collar.wizard.code.label")}</span>
              <input
                value={formatPairCode(code)}
                onChange={(e) => {
                  setCode(cleanPairCode(e.target.value).slice(0, PAIR_CODE_LENGTH));
                  setCodeError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitCode();
                }}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={PAIR_CODE_LENGTH + 1}
                aria-invalid={codeError ? true : undefined}
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
              />
              <span aria-hidden="true" className="flex items-center justify-between gap-1">
                {Array.from({ length: PAIR_CODE_LENGTH }, (_, i) => (
                  <Fragment key={i}>
                    {i === 4 && <span className="h-0.5 w-2 flex-shrink-0 rounded bg-ink-soft" />}
                    <span
                      className={cn(
                        "grid h-11 w-8 place-items-center rounded-[9px] border-[1.5px] bg-white font-mono text-lg font-bold",
                        codeError && codeError !== "network"
                          ? "border-danger bg-danger-soft text-danger"
                          : i === code.length
                            ? "border-brand ring-[3px] ring-brand/15"
                            : "border-ink/15",
                      )}
                    >
                      {code[i] ?? ""}
                    </span>
                  </Fragment>
                ))}
              </span>
            </label>
            <p className="mb-3 mt-1.5 text-[11.5px] text-ink-soft">{t("appPages.collar.wizard.code.hint")}</p>
            {codeError && (
              <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2.5 text-[12.5px] leading-snug text-[#8e2f27]">
                {t(`appPages.collar.wizard.code.${codeError}`)}
              </p>
            )}
            <button type="button" onClick={() => void submitCode()} disabled={!isPairCode(code) || busy}
              className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-50">
              {t("appPages.collar.wizard.code.submit")}
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">{t("appPages.collar.wizard.name.title")}</h2>
            <p className="mt-1 text-[13px] text-ink-soft">{t("appPages.collar.wizard.name.text")}</p>
            {pets.length > 0 && (
              <div className="my-3.5 flex flex-wrap gap-2">
                {pets.map((pet) => (
                  <button key={pet} type="button" aria-pressed={name === pet} onClick={() => setName(pet)}
                    className={cn("flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[13px] font-semibold", name === pet ? "border-brand bg-brand-softer text-brand-strong" : "border-ink/12 text-ink")}>
                    {pet}
                    {name === pet && <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
            <label className="mt-3 block text-xs font-semibold text-ink" htmlFor="collar-name">{t("appPages.collar.wizard.name.label")}</label>
            <input id="collar-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
              className="mb-4 mt-1.5 h-11 w-full rounded-xl border border-ink/12 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand" />
            <button type="button" onClick={() => void submitName()} disabled={busy}
              className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-50">
              {t("appPages.collar.wizard.name.submit")}
            </button>
          </div>
        )}

        {step === 4 && <ConnectChecklist onDone={onClose} onPlay={() => void playInstead()} />}
      </div>
    </div>
  );
}
