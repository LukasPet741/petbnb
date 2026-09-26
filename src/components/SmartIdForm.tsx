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
          <span className="flex-shrink-0 whitespace-nowrap rounded-md bg-amber-soft px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-amber-strong">SK DEMO</span>
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
