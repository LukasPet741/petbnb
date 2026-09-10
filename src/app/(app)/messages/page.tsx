"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, MessageCircle, Search } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { stagger, fadeUp } from "@/lib/motion";
import { timeAgo } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { Booking, Message, Thread } from "@/lib/types";

// The two profile embeds name their columns because neither role holds a
// table-level SELECT on profiles any more -- `profiles ( * )` is a 42501, not a
// quiet omission, and this page has an error state it would land in.
const BOOKING_SELECT = `
  *,
  owner:profiles!bookings_owner_id_fkey ( id, full_name, avatar_url ),
  sitter:profiles!bookings_sitter_id_fkey ( id, full_name, avatar_url ),
  pet:pets ( * )
`;

function lastMessageTime(thread: Thread) {
  return thread.lastMessage ? new Date(thread.lastMessage.created_at).getTime() : 0;
}

export default function MessagesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);

    void (async () => {
      const { data: bookingRows, error: bookingError } = await supabase
        .from("bookings")
        .select(BOOKING_SELECT)
        .or(`owner_id.eq.${user.id},sitter_id.eq.${user.id}`);
      if (!active) return;
      if (bookingError) {
        setFailed(true);
        setLoading(false);
        return;
      }

      const bookings = (bookingRows ?? []) as unknown as Booking[];
      if (bookings.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      const { data: messageRows, error: messageError } = await supabase
        .from("messages")
        .select("*")
        .in("booking_id", bookings.map((b) => b.id))
        .order("created_at", { ascending: true });
      if (!active) return;
      if (messageError) {
        setFailed(true);
        setLoading(false);
        return;
      }

      const byBooking = new Map<string, Message[]>();
      for (const message of (messageRows ?? []) as unknown as Message[]) {
        const bucket = byBooking.get(message.booking_id);
        if (bucket) bucket.push(message);
        else byBooking.set(message.booking_id, [message]);
      }

      // A booking only becomes a thread once something has been said on it —
      // the request itself always writes a system row, so quiet bookings are rare.
      const next: Thread[] = [];
      for (const booking of bookings) {
        const thread = byBooking.get(booking.id);
        if (!thread || thread.length === 0) continue;
        next.push({
          booking,
          counterparty: (booking.owner_id === user.id ? booking.sitter : booking.owner) ?? null,
          lastMessage: thread[thread.length - 1],
          unreadCount: thread.reduce(
            (count, m) => (!m.read_at && m.sender_id !== user.id ? count + 1 : count),
            0
          ),
        });
      }
      next.sort((a, b) => lastMessageTime(b) - lastMessageTime(a));

      setThreads(next);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const previewOf = (thread: Thread, counterpartyName: string) => {
    const message = thread.lastMessage;
    if (!message) return t("messages.threadListNoMessages");
    if (message.kind === "system" && message.event) {
      const actor =
        message.sender_id === user?.id
          ? profile?.full_name || t("messages.unknownPerson")
          : counterpartyName;
      return t(`messages.systemEvent.${message.event}`, { actor });
    }
    const body = message.body ?? "";
    return message.sender_id === user?.id ? `${t("messages.threadListYouPrefix")}${body}` : body;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader title={t("messages.title")} subtitle={t("messages.subtitle")} />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : failed ? (
        <EmptyState icon={AlertCircle} title={t("messages.threadListLoadFailed")} tone="error" />
      ) : threads.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={t("messages.emptyTitle")}
          description={t("messages.emptyDescription")}
          action={
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors"
            >
              <Search className="w-4 h-4" />
              {t("messages.findASitter")}
            </Link>
          }
          tone="encouraging"
        />
      ) : (
        <motion.div className="space-y-3" variants={stagger(0.07)} initial="hidden" animate="show">
          {threads.map((thread) => {
            const name = thread.counterparty?.full_name || t("messages.unknownPerson");
            const petName = thread.booking.pet?.name || t("messages.notifications.fallbackPet");
            const unread = thread.unreadCount > 0;
            return (
              <motion.div key={thread.booking.id} variants={fadeUp}>
                <Link
                  href={`/messages/${thread.booking.id}`}
                  className="flex items-start gap-4 bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-4 sm:p-5 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:-translate-y-px active:shadow-[var(--shadow-sm)]"
                >
                  <Avatar name={name} url={thread.counterparty?.avatar_url} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className={`truncate text-ink ${unread ? "font-semibold" : "font-medium"}`}>{name}</span>
                      {thread.lastMessage && (
                        <span className="ml-auto flex-shrink-0 text-xs text-ink-soft">
                          {timeAgo(thread.lastMessage.created_at, t)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-soft truncate mt-0.5">
                      {petName} · {t(`common.services.${thread.booking.service}`)}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className={`min-w-0 flex-1 truncate text-sm ${unread ? "text-ink" : "text-ink-soft"}`}>
                        {previewOf(thread, name)}
                      </p>
                      {unread && (
                        <span className="flex-shrink-0 inline-flex items-center h-5 px-2 rounded-full bg-brand text-white text-[11px] font-semibold leading-none">
                          {t("messages.threadListUnread", { count: thread.unreadCount })}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
