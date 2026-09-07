"use client";
import { useLanguage } from "@/context/LanguageContext";
import type { LegalDoc } from "@/lib/legal";

/**
 * Renders one legal document from the `legal.<doc>.*` dictionary namespace.
 *
 * Both documents are identical in shape, so the pages under src/app/legal are
 * composition only — this holds the layout, they choose which sections to pass.
 * Every key here is built by concatenation, which src/lib/i18n/__tests__/legal.test.ts
 * exists to guard: a missing entry would render its own dot-path onto the page.
 */
export default function LegalDocument({
  doc,
  sections,
}: {
  doc: LegalDoc;
  sections: readonly string[];
}) {
  const { t } = useLanguage();

  return (
    <article>
      <h1 className="font-display text-4xl font-semibold text-ink mb-2 tracking-tight">
        {t(`legal.${doc}.title`)}
      </h1>
      <p className="text-ink-soft text-sm mb-6">{t(`legal.${doc}.lastUpdated`)}</p>
      <p className="text-ink-soft leading-relaxed mb-8">{t(`legal.${doc}.intro`)}</p>

      <div className="space-y-4">
        {sections.map((id) => (
          <section
            key={id}
            className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6"
          >
            <h2 className="font-semibold text-ink mb-2.5">
              {t(`legal.${doc}.sections.${id}.heading`)}
            </h2>
            <p className="text-ink-soft text-sm leading-relaxed">
              {t(`legal.${doc}.sections.${id}.body`)}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-ink-soft text-sm">
          {t(`legal.${doc}.contactPrefix`)}{" "}
          <a href="mailto:hello@petbnb.lt" className="text-brand hover:underline">
            {t(`legal.${doc}.contactCta`)}
          </a>
        </p>
      </div>
    </article>
  );
}
