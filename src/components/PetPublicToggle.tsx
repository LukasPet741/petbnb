"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { Globe, Link2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import { setPetPublic, type CommunityClient } from "@/lib/placeCommunity";
import { cn } from "@/lib/utils";

/**
 * Under a pet's card on /pets: the switch for its public profile (/p/[id]: name, kind, photo and
 * the places it goes, nothing else), and its link once it is public. Shown only when the pet row
 * has is_public, i.e. once the community migration is live; off until the owner turns it on.
 */
export default function PetPublicToggle({ pet }: { pet: { id: string; name: string; is_public?: boolean } }) {
  const { t } = useLanguage();
  const [isPublic, setIsPublic] = useState(pet.is_public === true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const id = useId();
  if (pet.is_public === undefined) return null;

  const toggle = async () => {
    setBusy(true);
    // The community columns are not in database.types.ts until it is regenerated; see CommunityClient.
    const error = await setPetPublic(supabase as unknown as CommunityClient, pet.id, !isPublic);
    setBusy(false);
    if (!error) setIsPublic(!isPublic);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-input)] border border-ink/8 bg-surface/70 px-3 py-2 text-sm">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-ink">
        <input id={id} type="checkbox" role="switch" checked={isPublic} disabled={busy} onChange={toggle} className="peer sr-only" />
        <span aria-hidden="true" className={cn(
          "relative h-5 w-9 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
          isPublic ? "bg-brand" : "bg-ink/20",
        )}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", isPublic ? "translate-x-4" : "translate-x-0.5")} />
        </span>
        <Globe className="h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
        {t("partners.petPage.toggle")}
      </label>
      {isPublic ? (
        <span className="flex items-center gap-3">
          <Link href={`/p/${pet.id}`} className="font-medium text-brand hover:underline">{t("partners.petPage.open")}</Link>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}/p/${pet.id}`);
                setCopied(true);
              } catch {}
            }}
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t(copied ? "partners.petPage.copied" : "partners.petPage.copy")}
          </button>
        </span>
      ) : (
        <span className="text-xs text-ink-soft">{t("partners.petPage.hint")}</span>
      )}
    </div>
  );
}
