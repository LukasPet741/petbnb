import type { AppNotification } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * What a notification reads as, shared by the bell and the dashboard feed.
 *
 * No display text is stored on the row: it is rebuilt from the type plus the joined
 * actor/booking/pet on every render, in the active locale. The sentence names only who did
 * what, with the actor as its subject; the pet and the service go on the line under it
 * (dashboard design A). Slotted mid-sentence they needed a Lithuanian case the data does not
 * carry — "pateikė Dienos priežiūra užklausą", "pažymėjo Rudis užsakymą" — and a missing
 * booking join left a double space behind.
 */
export function notificationSentence(n: AppNotification, t: Translate): string {
  return t(`messages.notifications.${n.type}`, { actor: notificationActor(n, t) });
}

/** Trim-then-fallback, as MessageThread does: an empty or blank name reads as "Someone". */
export function notificationActor(n: AppNotification, t: Translate): string {
  return n.actor?.full_name?.trim() || t("messages.unknownPerson");
}

/** "Rudis · Dienos priežiūra": whichever of the pet and the service the booking join brought. */
export function notificationContext(n: AppNotification, t: Translate): string {
  const service = n.booking?.service ? t(`common.services.${n.booking.service}`) : null;
  return [n.booking?.pet?.name?.trim() || null, service].filter(Boolean).join(" · ");
}

/** The line under the sentence: the context, then how long ago. */
export function notificationMeta(n: AppNotification, t: Translate): string {
  return [notificationContext(n, t), timeAgo(n.created_at, t)].filter(Boolean).join(" · ");
}
