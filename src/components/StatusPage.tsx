"use client";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Logo from "@/components/Logo";

/**
 * The frame of the not-found and error pages: one glass card on the site's atmosphere, with
 * the logo and a way back, so a dead link or a crash never leaves the visitor on Next's
 * unstyled default.
 */
export default function StatusPage({
  code,
  title,
  body,
  children,
}: {
  code: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6">
      <LanguageSwitcher className="fixed top-4 right-4 z-10 glass-panel border rounded-full" />
      <div className="w-full max-w-md glass-card rounded-[var(--radius-card)] border p-6 sm:p-8 text-center">
        <Link href="/" className="inline-block mb-8" aria-label="PetBnB">
          <Logo size={36} showWordmark />
        </Link>
        <p className="font-display text-5xl font-semibold text-brand mb-3" aria-hidden="true">{code}</p>
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">{title}</h1>
        <p className="text-sm text-ink-soft leading-relaxed mb-7">{body}</p>
        <div className="flex flex-col gap-2.5">{children}</div>
      </div>
    </div>
  );
}

export const statusPrimaryClass =
  "w-full h-11 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors inline-flex items-center justify-center";

export const statusSecondaryClass =
  "w-full h-11 rounded-xl border border-black/10 bg-surface text-ink font-medium text-sm hover:bg-brand-soft transition-colors inline-flex items-center justify-center";
