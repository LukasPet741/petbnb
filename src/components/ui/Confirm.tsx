"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import Button from "./Button";
import Dialog from "./Dialog";

/**
 * Erasing with Confirm (plan §2.4): when someone else is affected or it cannot come back.
 * The title states the consequence, the danger button repeats the verb, and focus starts
 * on the safe choice. `const ok = await confirm({...})` — never window.confirm.
 */

export interface ConfirmOptions {
  /** The consequence, as a question: "Cancel Rudis's stay with Karolis?" */
  title: string;
  /** Who is affected and what happens next. */
  body?: string;
  /** The act, repeated on the button: "Cancel stay". */
  confirmLabel: string;
  /** The safe choice; defaults to "Keep". */
  cancelLabel?: string;
  tone?: "danger" | "primary";
}

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  // Kept after closing so the dialog still has its words while it animates out.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const keep = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  const danger = (options?.tone ?? "danger") === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        onClose={() => answer(false)}
        title={options?.title ?? ""}
        description={options?.body}
        size="sm"
        initialFocus={keep}
        icon={
          danger ? (
            <span className="w-11 h-11 rounded-full bg-danger-soft text-danger inline-flex items-center justify-center" aria-hidden="true">
              <AlertTriangle className="w-5 h-5" />
            </span>
          ) : undefined
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button ref={keep} variant="secondary" size="lg" className="sm:h-11 sm:text-sm" onClick={() => answer(false)}>
              {options?.cancelLabel ?? t("common.ui.keep")}
            </Button>
            <Button variant={danger ? "danger" : "primary"} size="lg" className="sm:h-11 sm:text-sm" onClick={() => answer(true)}>
              {options?.confirmLabel}
            </Button>
          </div>
        }
      />
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
