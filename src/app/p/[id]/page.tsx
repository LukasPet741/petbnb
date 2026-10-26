"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Cat, Dog, PawPrint } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import { fetchPublicPet, type CommunityClient, type PublicPet } from "@/lib/placeCommunity";

/**
 * A public pet profile (ecosystem plan, "Social, kept small at first"): name, kind, photo and the
 * places the pet goes, and nothing else. Only for a pet whose owner made it public; any other id,
 * or one that turns private again, shows the same "private or gone" page.
 */
export default function PublicPetPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [pet, setPet] = useState<PublicPet | null | undefined>(undefined);

  useEffect(() => {
    // The pet functions are not in the generated types yet; see CommunityClient.
    fetchPublicPet(supabase as unknown as CommunityClient, id).then(setPet);
  }, [id]);

  const Icon = pet?.type === "cat" ? Cat : pet?.type === "dog" ? Dog : PawPrint;

  return (
    <div className="min-h-[100dvh]">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 lg:py-12">
        {pet === undefined ? (
          <div className="h-64 animate-pulse rounded-[var(--radius-hero)] bg-ink/5" />
        ) : pet === null ? (
          <div className="rounded-[var(--radius-card)] border border-ink/8 bg-surface p-8 text-center">
            <p className="text-ink">{t("partners.petPage.notFound")}</p>
            <Link href="/partners" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              {t("partners.petPage.map")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <article className="overflow-hidden rounded-[var(--radius-hero)] border border-ink/8 bg-surface shadow-[var(--shadow-sm)]">
            <header className="pb-band flex flex-col items-center gap-4 px-6 py-10 text-center">
              {pet.photoUrl ? (
                <img src={pet.photoUrl} alt="" referrerPolicy="no-referrer" className="h-32 w-32 rounded-full object-cover ring-4 ring-[var(--chrome-line)]" />
              ) : (
                <span aria-hidden="true" className="grid h-32 w-32 place-items-center rounded-full bg-[var(--chrome-active)] text-[var(--hero-accent)]">
                  <Icon className="h-14 w-14" />
                </span>
              )}
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-chrome-ink">{pet.name}</h1>
                <p className="mt-1 text-chrome-ink-soft">{t(`common.petTypes.${pet.type}`)}</p>
              </div>
            </header>
            <section className="p-6">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("partners.petPage.places", { name: pet.name })}</h2>
              {pet.places.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">{t("partners.petPage.noPlaces")}</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-ink/8">
                  {pet.places.map((place) => (
                    <li key={place.slug}>
                      <Link href={`/partners?p=${place.slug}`} className="group flex items-center gap-3 py-3">
                        {place.logo ? (
                          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[22%] bg-white ring-1 ring-ink/8">
                            <img src={place.logo} alt="" className="h-[78%] w-[78%] object-contain" />
                          </span>
                        ) : (
                          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-[22%] bg-brand-soft text-brand-strong">
                            <PawPrint className="h-5 w-5" />
                          </span>
                        )}
                        <span className="font-medium text-ink group-hover:text-brand">{place.name}</span>
                        <ArrowRight className="ml-auto h-4 w-4 text-ink-soft group-hover:text-brand" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
