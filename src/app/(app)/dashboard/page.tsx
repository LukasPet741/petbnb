"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFavorites } from "@/context/FavoritesContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useLanguage } from "@/context/LanguageContext";
import DashboardView from "@/components/dashboard/DashboardView";
import { pickHero, waitingList, type DashBooking } from "@/lib/dashboard";

interface Pet { id: string; name: string; type: string; photo_url: string | null; }

const BOOKING_FIELDS = "id,status,service,start_at,end_at, pet:pets(id,name,photo_url,type)";

/**
 * Loads what the dashboard shows and hands it to DashboardView. Bookings are read from both
 * sides — the visitor's own, and, for a sitter, the ones made with them — because the most
 * urgent thing a sitter can have is a request waiting on their answer.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { count: savedCount } = useFavorites();
  const { notifications, loading: notificationsLoading, unreadCount, markAllRead, markRead } = useNotifications();
  const { t } = useLanguage();
  const [pets, setPets] = useState<Pet[]>([]);
  const [owner, setOwner] = useState<DashBooking[]>([]);
  const [sitter, setSitter] = useState<DashBooking[]>([]);
  const isSitter = profile?.is_sitter ?? false;

  useEffect(() => {
    if (!user) return;
    supabase.from("pets").select("id,name,type,photo_url").eq("owner_id", user.id).order("created_at")
      .then(({ data }) => setPets((data as Pet[]) ?? []));
    supabase.from("bookings").select(`${BOOKING_FIELDS}, counterpart:profiles!bookings_sitter_id_fkey(id,full_name,avatar_url)`).eq("owner_id", user.id)
      .then(({ data }) => setOwner((data as unknown as DashBooking[]) ?? []));
  }, [user]);

  useEffect(() => {
    if (!user || !isSitter) { setSitter([]); return; }
    supabase.from("bookings").select(`${BOOKING_FIELDS}, counterpart:profiles!bookings_owner_id_fkey(id,full_name,avatar_url)`).eq("sitter_id", user.id)
      .then(({ data }) => setSitter((data as unknown as DashBooking[]) ?? []));
  }, [user, isSitter]);

  const now = Date.now();
  const hero = pickHero({ owner, sitter, now });

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
    />
  );
}
