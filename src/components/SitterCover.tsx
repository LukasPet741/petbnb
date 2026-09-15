"use client";
import type { Profile } from "@/lib/types";
import { HERO, SERVICE_PHOTO_FOCUS, coverFocus, coverPhotoFor, coverService } from "@/lib/images";
import { useLanguage } from "@/context/LanguageContext";

/**
 * The photo band at the top of a sitter profile, which the header and price cards float
 * over as glass. Used by both the public profile and the signed-in one.
 *
 * The photo is of the sitter's first service, not of the sitter: they upload an avatar
 * and nothing else. The caption names the service so the picture reads as "dog walking",
 * never as "this is Rūta". A sitter who offers nothing gets the landing page's hero frame
 * and no caption.
 *
 * aria-hidden as a whole: the caption repeats a service badge the header card already
 * announces, and the image is decoration.
 */
export default function SitterCover({ sitter }: { sitter: Pick<Profile, "id" | "services"> }) {
  const { t } = useLanguage();
  const service = coverService(sitter.services);
  // The same pick as the sitter's card in /browse, so opening a card keeps its picture.
  const src = service ? coverPhotoFor(sitter.id, service, 1600) : HERO.wide;
  // HERO.wide is the walking frame, so the fallback shares walking's focus.
  const focus = service ? coverFocus(src, service) : SERVICE_PHOTO_FOCUS.walking;

  return (
    <div aria-hidden className="relative h-44 sm:h-60 overflow-hidden rounded-[var(--radius-card)] bg-surface-2">
      <img src={src} alt="" referrerPolicy="no-referrer" style={{ objectPosition: focus }} className="absolute inset-0 h-full w-full object-cover" />
      {/* Darkens only the top, where the caption sits; the bottom stays bright because the
          header card covers it and needs colour behind its glass, not shadow. */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink/35 to-transparent" />
      {service && (
        <span className="glass-chip-dark absolute left-4 top-4 sm:left-5 sm:top-5 inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium text-white">
          {t(`common.services.${service}`)}
        </span>
      )}
    </div>
  );
}
