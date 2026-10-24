"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFavorites } from "@/context/FavoritesContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import DashboardView from "@/components/dashboard/DashboardView";
import type { AnswerActions } from "@/components/dashboard/NextUpCard";
import { agendaList, bookedDays, dashboardStats, pickHero, toFinishList, waitingList, type DashBooking } from "@/lib/dashboard";
import { onboardingSteps } from "@/lib/sitter-onboarding";
import { bookingPriceView } from "@/lib/booking-price-view";
import { acceptClashKey, problemFromHint } from "@/lib/availability";
import type { NegotiationBooking, OfferLike } from "@/lib/pricing";

interface Pet { id: string; name: string; type: string; photo_url: string | null; }

const BOOKING_FIELDS = "id,status,service,start_at,end_at,notes,asking_price,agreed_price,owner_id,sitter_id, pet:pets(id,name,photo_url,type)";

/**
 * Loads what the dashboard shows and hands it to DashboardView. Bookings are read from both
 * sides — the visitor's own, and, for a sitter, the ones made with them — because the most
 * urgent thing a sitter can have is a request waiting on their answer.
 *
 * It also owns the dashboard's writes (Night Forest, 2026-10-24): accepting or declining the
 * lead request and marking a finished booking done. They are the same updates /bookings sends,
 * with the same messages, and the database applies the same rules to both.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { count: savedCount } = useFavorites();
  const { notifications, loading: notificationsLoading, unreadCount, markAllRead, markRead } = useNotifications();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const confirm = useConfirm();
  usePageTitle(t("appShell.sidebar.nav.dashboard"));
  const [pets, setPets] = useState<Pet[]>([]);
  const [owner, setOwner] = useState<DashBooking[]>([]);
  const [sitter, setSitter] = useState<DashBooking[]>([]);
  const [ratings, setRatings] = useState<number[]>([]);
  const [offers, setOffers] = useState<OfferLike[]>([]);
  const [busy, setBusy] = useState(false);
  // Bumped after a write, so every list re-reads what the database now holds.
  const [version, setVersion] = useState(0);
  const isSitter = profile?.is_sitter ?? false;

  useEffect(() => {
    if (!user) return;
    supabase.from("pets").select("id,name,type,photo_url").eq("owner_id", user.id).is("archived_at", null).order("created_at")
      .then(({ data }) => setPets((data as Pet[]) ?? []));
    supabase.from("bookings").select(`${BOOKING_FIELDS}, counterpart:profiles!bookings_sitter_id_fkey(id,full_name,avatar_url)`).eq("owner_id", user.id)
      .then(({ data }) => setOwner((data as unknown as DashBooking[]) ?? []));
    supabase.from("reviews").select("rating").eq("subject_id", user.id)
      .then(({ data }) => setRatings(((data as { rating: number }[] | null) ?? []).map((r) => r.rating)));
  }, [user, version]);

  useEffect(() => {
    if (!user || !isSitter) { setSitter([]); return; }
    supabase.from("bookings").select(`${BOOKING_FIELDS}, counterpart:profiles!bookings_owner_id_fkey(id,full_name,avatar_url)`).eq("sitter_id", user.id)
      .then(({ data }) => setSitter((data as unknown as DashBooking[]) ?? []));
  }, [user, isSitter, version]);

  const now = Date.now();
  const hero = pickHero({ owner, sitter, now });
  const leadId = hero.kind === "answer" ? hero.booking.id : null;

  // The offers on the request the lead card answers: what is on the table decides the price.
  useEffect(() => {
    if (!leadId) { setOffers([]); return; }
    supabase.from("messages").select("id, booking_id, sender_id, amount, created_at").eq("kind", "offer").eq("booking_id", leadId)
      .then(({ data }) => setOffers(
        ((data as { id: string; sender_id: string; amount: number | null; created_at: string }[] | null) ?? [])
          .filter((row) => row.amount != null)
          .map((row) => ({ id: row.id, sender_id: row.sender_id, amount: row.amount as number, created_at: row.created_at })),
      ));
  }, [leadId, version]);

  const say = (key: string, tone?: "error") => toast({ message: t(key), tone });
  const write = async (run: () => PromiseLike<{ error: { hint?: string | null } | null }>, onError: (hint?: string | null) => void, done: string) => {
    setBusy(true);
    const { error } = await run();
    setBusy(false);
    setVersion((v) => v + 1);
    if (error) { onError(error.hint); return; }
    say(done);
  };

  let answer: AnswerActions | null = null;
  if (hero.kind === "answer" && hero.booking.owner_id && hero.booking.sitter_id) {
    const booking = hero.booking;
    const price = bookingPriceView(booking as unknown as NegotiationBooking & { agreed_price?: number | null }, offers, "sitter", t, locale);
    answer = {
      priceLine: price.priceLine,
      canAccept: price.canAccept,
      acceptLabel: price.acceptLabel,
      waitingLabel: price.waitingLabel,
      busy,
      // Accepting sends the amount the sitter saw; the database refuses it if the table has moved on.
      onAccept: () => {
        if (price.acceptAmount === null) return;
        const amount = price.acceptAmount;
        void write(
          () => supabase.from("bookings").update({ status: "signed", agreed_price: amount }).eq("id", booking.id),
          (hint) => {
            const problem = problemFromHint(hint);
            say(problem ? acceptClashKey(problem, "sitter", "appPages.bookings") : hint === "price_changed" ? "appPages.bookings.priceChanged" : "appPages.bookings.actionFailed", "error");
          },
          "appPages.bookings.toastAccepted",
        );
      },
      onDecline: async () => {
        const ok = await confirm({
          title: t("appPages.bookings.confirmDecline.title"),
          body: t("appPages.bookings.confirmDecline.body", { name: booking.counterpart?.full_name ?? t("appPages.bookings.ownerLabel") }),
          confirmLabel: t("appPages.bookings.declineButton"),
        });
        if (!ok) return;
        void write(
          () => supabase.from("bookings").update({ status: "declined" }).eq("id", booking.id),
          () => say("appPages.bookings.actionFailed", "error"),
          "appPages.bookings.toastDeclined",
        );
      },
    };
  }

  const markDone = (booking: DashBooking) =>
    void write(
      () => supabase.from("bookings").update({ status: "completed" }).eq("id", booking.id),
      () => say("appPages.bookings.actionFailed", "error"),
      "appPages.bookings.toastCompleted",
    );

  return (
    <DashboardView
      firstName={profile?.full_name?.split(" ")[0] ?? t("appShell.dashboard.fallbackName")}
      now={now}
      hero={hero}
      waiting={waitingList({ owner, sitter, hero, now })}
      pets={pets}
      savedCount={savedCount}
      notifications={notifications}
      notificationsLoading={notificationsLoading}
      unreadCount={unreadCount}
      onMarkAllRead={() => void markAllRead()}
      onOpenNotification={(n) => { if (!n.read_at) void markRead([n.id]); }}
      onboarding={isSitter && profile ? onboardingSteps(profile) : null}
      stats={dashboardStats({ owner, sitter, now }, ratings)}
      answer={answer}
      agenda={agendaList({ owner, sitter, now }, hero.kind === "next" ? hero.booking.id : null)}
      booked={bookedDays({ owner, sitter, now })}
      toFinish={toFinishList(sitter, now)}
      onMarkDone={markDone}
      busy={busy}
    />
  );
}
