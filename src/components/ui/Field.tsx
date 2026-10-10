"use client";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A labelled control (plan §2.3): the label, an optional hint, the error said in the field
 * itself, and a counter — all tied to the control for screen readers. The control is a
 * render prop so any input fits: `<Field label="…">{(p) => <Input {...p} />}</Field>`.
 */

export interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export default function Field({
  label,
  hint,
  error,
  optional,
  counter,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Shown after the label, e.g. "optional". */
  optional?: string;
  counter?: { value: number; max: number };
  className?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control: ControlProps = { id, "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}) };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-ink-soft"> · {optional}</span>}
      </label>
      {children(control)}
      {hint && (
        <p id={hintId} className="text-xs font-semibold text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {counter && (
        <span className="self-end text-xs font-semibold text-ink-soft tabular-nums">
          {counter.value} / {counter.max}
        </span>
      )}
    </div>
  );
}

const isInvalid = (v: unknown) => v === true || v === "true";

export function controlClasses(invalid: boolean) {
  return cn(
    "w-full rounded-[var(--radius-control)] border bg-surface px-3.5 text-ink placeholder:text-ink-soft",
    "transition-[border-color,box-shadow] duration-[var(--dur-quick)] focus:outline-none focus:ring-4",
    invalid ? "border-danger focus:border-danger focus:ring-danger-soft" : "border-ink/15 focus:border-brand focus:ring-brand-soft",
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(controlClasses(isInvalid(rest["aria-invalid"])), "h-12", className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(controlClasses(isInvalid(rest["aria-invalid"])), "py-3 min-h-24 resize-y", className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...rest} className={cn(controlClasses(isInvalid(rest["aria-invalid"])), "h-12 appearance-none pr-10", className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" aria-hidden="true" />
    </div>
  );
}
