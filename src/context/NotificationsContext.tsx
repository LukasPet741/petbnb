"use client";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { AppNotification } from "@/lib/types";

/**
 * One realtime subscription for the whole app, shared by NotificationBell and
 * the Sidebar unread badge. Mounted once in (app)/layout.tsx — two components
 * subscribing separately would open two channels for the same rows.
 *
 * Notifications are written exclusively by SECURITY DEFINER triggers on
 * `bookings` and `messages`; this context is read-only apart from the two
 * read-marking RPCs.
 */

const SELECT = `
  id, user_id, actor_id, booking_id, type, read_at, created_at, email_status, email_error,
  actor:profiles!notifications_actor_id_fkey ( id, full_name, avatar_url ),
  booking:bookings!notifications_booking_id_fkey (
    id, service, start_at, end_at, status, owner_id, sitter_id,
    pet:pets ( id, name, photo_url, type )
  )
`;

interface NotificationsValue {
  notifications: AppNotification[];
  unreadCount: number;
  /** Unread notifications grouped by booking, for the per-thread dot. */
  unreadByBooking: Record<string, number>;
  loading: boolean;
  markAllRead: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  /** Clears message + booking notifications for one thread, via mark_thread_read. */
  markThreadRead: (bookingId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue>({
  notifications: [],
  unreadCount: 0,
  unreadByBooking: {},
  loading: true,
  markAllRead: async () => {},
  markRead: async () => {},
  markThreadRead: async () => {},
  refresh: async () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  // Read inside the realtime callback without making it a subscription dep,
  // which would tear down and rebuild the channel on every incoming row.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("notifications")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setNotifications((data ?? []) as unknown as AppNotification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    load().then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [user, load]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch rather than trusting the payload: the realtime row is flat,
          // and the UI needs the actor/booking/pet joins to render a sentence.
          void load();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, load]);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) && !n.read_at ? { ...n, read_at: now } : n))
    );
    const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids });
    if (error) await load();
  }, [load]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    const { error } = await supabase.rpc("mark_notifications_read", { p_ids: null });
    if (error) await load();
  }, [load]);

  const markThreadRead = useCallback(async (bookingId: string) => {
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.booking_id === bookingId && !n.read_at ? { ...n, read_at: now } : n))
    );
    // Clears unread messages in the thread AND its message_received notification.
    const { error } = await supabase.rpc("mark_thread_read", { p_booking_id: bookingId });
    // Booking-status notifications for this thread aren't covered by that RPC.
    const statusIds = notifications
      .filter((n) => n.booking_id === bookingId && !n.read_at && n.type !== "message_received")
      .map((n) => n.id);
    if (statusIds.length > 0) {
      await supabase.rpc("mark_notifications_read", { p_ids: statusIds });
    }
    if (error) await load();
  }, [notifications, load]);

  const unreadCount = notifications.reduce((n, row) => (row.read_at ? n : n + 1), 0);

  const unreadByBooking: Record<string, number> = {};
  for (const n of notifications) {
    if (n.read_at || !n.booking_id) continue;
    unreadByBooking[n.booking_id] = (unreadByBooking[n.booking_id] ?? 0) + 1;
  }

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadByBooking,
        loading,
        markAllRead,
        markRead,
        markThreadRead,
        refresh: load,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
