"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pickRibbon } from "@/lib/home";
import { priceSummary } from "@/lib/pricing";
import { pluralForm } from "@/lib/i18n/plural";
import { formatCurrency } from "@/lib/utils";
import { type Profile } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { type HomeStatus } from "@/components/home/status";

const MAX_CHIPS = 12;

const initials = (name: string) =>
  name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

/** "{count} local sitters" with the number drawn large, whatever side of the noun it sits on. */
function withNumber(template: string, n: number) {
  const at = template.indexOf("{count}");
  if (at < 0) return template;
  return (
    <>
      {template.slice(0, at)}
      <span className="font-display text-lg font-semibold text-[var(--hero-accent)]">{n}</span>
      {template.slice(at + "{count}".length)}
    </>
  );
}

/**
 * The strip along the foot of the hero (Night Forest): how many sitters there are, then their
 * faces, each one a link to the profile, with city and starting price. It replaced the hills,
 * and it is where the landing page first touches real data, so it owns the loading and failure
 * states: chips that pulse while the list loads, and nothing at all if it fails or is empty,
 * leaving the hero to end on its own. A phone scrolls the chips sideways.
 */
export default function SitterRibbon({ sitters, status }: { sitters: Profile[]; status: HomeStatus }) {
  const { t, locale } = useLanguage();
  const picks = pickRibbon(sitters, MAX_CHIPS);
  if (status === "error" || (status === "ready" && picks.length === 0)) return null;

  const count = sitters.filter((s) => s.is_sitter).length;
  const seeAll = (
    <>
      {t("home.ribbon.seeAll")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </>
  );

  return (
    <section aria-label={t("home.ribbon.label")} className="border-t border-[var(--chrome-line)] bg-[var(--hero-from)] text-chrome-ink">
      <div className="max-w-6xl mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-center justify-between gap-3 sm:shrink-0">
          {status === "loading" ? (
            <span aria-hidden="true" className="h-6 w-36 animate-pulse rounded-full bg-[var(--chrome-active)]" />
          ) : (
            <p className="text-sm text-chrome-ink-soft">
              {withNumber(t(`home.ribbon.count.${pluralForm(locale, count)}`), count)}
            </p>
          )}
          <Link href="/browse" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-chrome-ink sm:hidden">
            {seeAll}
          </Link>
        </div>

        <ul className="-mx-4 flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 sm:[mask-image:linear-gradient(to_right,black_92%,transparent)]">
          {status === "loading"
            ? Array.from({ length: 6 }).map((_, i) => (
                <li key={i} aria-hidden="true" className="h-11 w-44 flex-shrink-0 animate-pulse rounded-full bg-[var(--chrome-active)]" />
              ))
            : picks.map((sitter) => {
                const name = sitter.full_name?.trim() || t("appShell.sitterFallback");
                const first = name.split(" ")[0];
                const price = priceSummary(sitter);
                const priceText = price
                  ? price.kind === "daily"
                    ? `${t("common.pricing.from")} ${formatCurrency(price.amount, locale)}`
                    : formatCurrency(price.amount, locale)
                  : null;
                return (
                  <li key={sitter.id} className="flex-shrink-0 snap-start">
                    <Link
                      href={`/browse/${sitter.id}`}
                      className="flex h-11 items-center gap-2.5 rounded-full border border-[var(--chrome-line)] bg-[var(--chrome-active)] pl-1.5 pr-4 text-sm transition-colors hover:border-chrome-ink-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-leaf"
                    >
                      {sitter.avatar_url ? (
                        <img src={sitter.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full bg-[var(--hill-mid)] object-cover" />
                      ) : (
                        <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-brand-mid text-xs font-semibold text-chrome-ink">
                          {initials(name)}
                        </span>
                      )}
                      <span className="whitespace-nowrap font-semibold">{first}</span>
                      <span className="whitespace-nowrap text-chrome-ink-soft">
                        {[sitter.city?.trim(), priceText].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  </li>
                );
              })}
        </ul>

        <Link href="/browse" className="hidden min-h-[44px] flex-shrink-0 items-center gap-1.5 text-sm font-medium text-chrome-ink hover:text-[var(--hero-accent)] sm:inline-flex">
          {seeAll}
        </Link>
      </div>
    </section>
  );
}
