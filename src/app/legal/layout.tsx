"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import { LEGAL_DOCS } from "@/lib/legal";

/**
 * Shared chrome for the legal documents. useSelectedLayoutSegment() reads the
 * segment one level below this layout, which is exactly the document name, so
 * the tabs need no prop drilling from the pages.
 *
 * These pages sit outside the (app) shell but the sidebar links here, so a signed-in
 * reader is sent back to the dashboard. Sending them to `/` put them on the public
 * landing page, which offers "Sign in" and looked exactly like being logged out.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const active = useSelectedLayoutSegment();
  const home = user ? "/dashboard" : "/";

  return (
    <div className="min-h-[100dvh]">
      <header className="glass border-b h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
          <Link href={home}>
            <Logo size={32} showWordmark />
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href={home}
          className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {t(user ? "legal.backToDashboard" : "legal.backLink")}
        </Link>

        <nav aria-label={t("common.terms")} className="flex gap-2 mb-8">
          {LEGAL_DOCS.map((doc) => {
            const isActive = active === doc;
            return (
              <Link
                key={doc}
                href={`/legal/${doc}`}
                aria-current={isActive ? "page" : undefined}
                className={`min-h-11 px-4 inline-flex items-center rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-ink text-white"
                    : "bg-white/60 text-ink-soft border border-black/5 hover:text-ink"
                }`}
              >
                {t(`legal.nav.${doc}`)}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}
