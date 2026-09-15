"use client";
import { ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { cn, formatDate } from "@/lib/utils";
import type { VerificationMethod } from "@/lib/types";

/**
 * The Smart-ID verification badge (spec 2026-09-15-smart-id-demo-badge-design.md).
 *
 * A rosette seal beside a name, in the site's own pine green, drawn here rather than borrowed
 * from any platform's verified mark. Only a verification someone actually went through shows
 * it: 'seed' (the demo catalogue) and 'none' render nothing. A demo verification says "demo"
 * in its label, and the profile's VerificationRow says it in words, so the badge never claims
 * more than was checked.
 */

export function showsBadge(method: VerificationMethod | null | undefined): boolean {
  return method === "smart_id_demo" || method === "smart_id";
}

/** A 16-point star with rounded joins reads as a scalloped seal at every size. */
const SEAL_POINTS = Array.from({ length: 32 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 32 - Math.PI / 2;
  const radius = i % 2 === 0 ? 10.6 : 9.1;
  return `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

const SIZES = { xs: "h-3.5 w-3.5", sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" } as const;

export default function VerifiedSeal({
  method,
  size = "sm",
  className,
}: {
  method: VerificationMethod | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { t } = useLanguage();
  if (!showsBadge(method)) return null;
  const label = t(method === "smart_id_demo" ? "common.verification.sealDemo" : "common.verification.seal");

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={cn("inline-block flex-shrink-0 text-brand", SIZES[size], className)}
    >
      <title>{label}</title>
      <polygon points={SEAL_POINTS} fill="currentColor" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M7.7 12.2l2.9 2.9 5.7-6" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The sentence under a verified sitter's name: who verified, that it is a demo, and when. */
export function VerificationRow({
  method,
  verifiedAt,
  className,
}: {
  method: VerificationMethod | null | undefined;
  verifiedAt: string | null | undefined;
  className?: string;
}) {
  const { t, locale } = useLanguage();
  if (!showsBadge(method)) return null;
  const demo = method === "smart_id_demo";

  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border border-brand/15 bg-brand-softer px-3.5 py-2.5", className)}>
      <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink">
          <span>{t("common.verification.rowTitle")}</span>
          {demo && (
            <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-amber-strong">
              {t("common.verification.demoTag")}
            </span>
          )}
          {verifiedAt && <span className="text-xs font-normal text-ink-soft">{formatDate(verifiedAt, locale)}</span>}
        </p>
        {demo && <p className="mt-0.5 text-xs text-ink-soft">{t("common.verification.demoNote")}</p>}
      </div>
    </div>
  );
}
