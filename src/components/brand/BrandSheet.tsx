"use client";
import Link from "next/link";
import { ArrowLeft, Download, MapPin, ShieldCheck, Tag, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import Logo, { LogoMark } from "@/components/Logo";
import { PALETTE, SIGNATURES, type Signature } from "@/lib/brand";

// One icon per promise, everywhere it appears (brand look A, 2026-10-10).
const SIGNATURE_ICONS: Record<Signature, LucideIcon> = {
  smartId: ShieldCheck,
  live: MapPin,
  agreed: Tag,
};

/**
 * The brand sheet at /brand: the mark, the colours, the type and the three promises.
 * A thesis appendix in page form, and the reference the app's own screens follow.
 * Public like the legal pages, and like them noindex (next.config.ts) — only / is indexed.
 */
export default function BrandSheet() {
  const { t } = useLanguage();
  const { user } = useAuth();
  usePageTitle(t("brand.title"));
  const home = user ? "/dashboard" : "/";

  return (
    <div className="min-h-[100dvh]">
      <header className="glass border-b h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto w-full">
          <Link href={home} className="inline-flex">
            <Logo size={32} showWordmark />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-14">
        <div>
          <Link href={home} className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("brand.backLink")}
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">{t("brand.title")}</h1>
          <p className="text-ink-soft mt-3 max-w-2xl leading-relaxed">{t("brand.intro")}</p>

          <div className="mt-8 rounded-[var(--radius-card)] bg-brand px-6 py-12 sm:py-16 flex flex-col items-center gap-5 text-center">
            <span className="inline-flex items-center gap-4">
              <LogoMark size={72} decorative className="sm:w-24 sm:h-24" />
              <span className="font-display font-bold tracking-[-0.04em] text-5xl sm:text-7xl text-[var(--linen)]">petbnb</span>
            </span>
            <p className="text-lg text-brand-soft">{t("brand.tagline")}</p>
          </div>
        </div>

        <section aria-labelledby="brand-logo">
          <h2 id="brand-logo" className="font-display text-2xl font-bold text-ink">{t("brand.logo.title")}</h2>
          <p className="text-ink-soft mt-2 max-w-2xl leading-relaxed">{t("brand.logo.text")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <figure className="glass-card border rounded-[var(--radius-card)] p-6 flex flex-col gap-4">
              <figcaption className="text-xs font-semibold text-ink-soft">{t("brand.logo.onLight")}</figcaption>
              <Logo size={44} showWordmark />
            </figure>
            <figure className="rounded-[var(--radius-card)] bg-ink p-6 flex flex-col gap-4">
              <figcaption className="text-xs font-semibold text-white/70">{t("brand.logo.onDark")}</figcaption>
              <Logo size={44} showWordmark wordmarkClassName="text-white" />
            </figure>
            <figure className="glass-card border rounded-[var(--radius-card)] p-6 flex flex-col gap-4">
              <figcaption className="text-xs font-semibold text-ink-soft">{t("brand.logo.sizes")}</figcaption>
              <span className="flex items-end gap-4">
                <LogoMark size={64} decorative />
                <LogoMark size={32} decorative />
                <LogoMark size={16} decorative />
              </span>
            </figure>
          </div>
          <a
            href="/icon.svg"
            download="petbnb-mark.svg"
            className="mt-4 inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-brand hover:text-brand-strong transition-colors"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> {t("brand.logo.download")}
          </a>
        </section>

        <section aria-labelledby="brand-colour">
          <h2 id="brand-colour" className="font-display text-2xl font-bold text-ink">{t("brand.colour.title")}</h2>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
            {PALETTE.map(({ id, token, hex }) => (
              <div key={id} className="flex flex-col gap-2">
                <div className="h-20 rounded-[var(--radius-input)] border border-black/5" style={{ background: hex }} />
                <span className="text-sm font-semibold text-ink">{t(`brand.colour.${id}`)}</span>
                <span className="text-xs text-ink-soft tabular-nums">{hex.toUpperCase()}</span>
                <code className="text-xs text-ink-soft">--{token}</code>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="brand-type">
          <h2 id="brand-type" className="font-display text-2xl font-bold text-ink">{t("brand.type.title")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="glass-card border rounded-[var(--radius-card)] p-6 flex flex-col gap-3">
              <span className="text-xs font-semibold text-ink-soft">{t("brand.type.display")}</span>
              <span className="font-display text-4xl font-bold tracking-tight text-brand leading-tight">{t("brand.type.sample")}</span>
            </div>
            <div className="glass-card border rounded-[var(--radius-card)] p-6 flex flex-col gap-3">
              <span className="text-xs font-semibold text-ink-soft">{t("brand.type.body")}</span>
              <span className="text-lg text-ink leading-relaxed">{t("brand.intro")}</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="brand-signatures">
          <h2 id="brand-signatures" className="font-display text-2xl font-bold text-ink">{t("brand.signatures.title")}</h2>
          <p className="text-ink-soft mt-2">{t("brand.signatures.text")}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {SIGNATURES.map((id) => {
              const Icon = SIGNATURE_ICONS[id];
              return (
                <li key={id} className="glass-card border rounded-[var(--radius-card)] p-6 flex flex-col gap-3">
                  <span className="w-11 h-11 rounded-full bg-brand-soft text-brand-strong inline-flex items-center justify-center">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="font-semibold text-ink">{t(`brand.signatures.${id}.name`)}</span>
                  <span className="text-sm text-ink-soft leading-relaxed">{t(`brand.signatures.${id}.text`)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
