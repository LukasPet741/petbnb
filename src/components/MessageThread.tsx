"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircleOff, Send, TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationsContext";
import { STATUS_CONFIG, type BookingStatus, type MessageKind, type ServiceType, type SystemEvent } from "@/lib/types";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";

interface ThreadParty {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ThreadBooking {
  id: string;
  status: BookingStatus;
  service: ServiceType;
  start_at: string;
  end_at: string;
  owner_id: string;
  sitter_id: string;
  owner: ThreadParty | null;
  sitter: ThreadParty | null;
  pet: { id: string; name: string; photo_url: string | null } | null;
}

interface ThreadMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  event: SystemEvent | null;
  created_at: string;
  sender: ThreadParty | null;
  /** Stable React key: an optimistic row keeps its client key once the server row replaces it, so the bubble doesn't remount and replay its entrance. */
  key: string;
  /** Set only while a locally appended row is still awaiting its server round-trip. */
  pending?: boolean;
}

const BOOKING_SELECT = `
  id, status, service, start_at, end_at, owner_id, sitter_id,
  owner:profiles!bookings_owner_id_fkey ( id, full_name, avatar_url ),
  sitter:profiles!bookings_sitter_id_fkey ( id, full_name, avatar_url ),
  pet:pets ( id, name, photo_url )
`;

const MESSAGE_SELECT = `
  id, booking_id, sender_id, kind, body, event, created_at,
  sender:profiles!messages_sender_id_fkey ( id, full_name, avatar_url )
`;

const INPUT_CLASS =
  "w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition";

const COMPOSER_MAX_HEIGHT = 160;

let optimisticSeq = 0;

function toThreadMessage(row: unknown, key?: string): ThreadMessage {
  const message = row as ThreadMessage;
  return { ...message, key: key ?? message.id };
}

function startOfDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-4">
      <span className="px-3 py-1 rounded-full bg-surface-2 text-[11px] font-medium text-ink-soft">{label}</span>
    </div>
  );
}

export default function MessageThread({ bookingId }: { bookingId: string }) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { markThreadRead } = useNotifications();

  const [booking, setBooking] = useState<ThreadBooking | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"failed" | "missing" | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasScrolledRef = useRef(false);
  // markThreadRead's identity changes with every notification row; holding it in a ref
  // keeps the read-marking effect from re-firing the RPC on unrelated updates.
  const markThreadReadRef = useRef(markThreadRead);
  markThreadReadRef.current = markThreadRead;

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setLoadError(null);

    (async () => {
      const [bookingResult, messagesResult] = await Promise.all([
        supabase.from("bookings").select(BOOKING_SELECT).eq("id", bookingId).maybeSingle(),
        supabase
          .from("messages")
          .select(MESSAGE_SELECT)
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: true }),
      ]);
      if (!active) return;

      if (bookingResult.error || messagesResult.error) {
        setLoadError("failed");
      } else if (!bookingResult.data) {
        // RLS hides bookings the viewer isn't a party to, so "no row" means "not yours".
        setLoadError("missing");
      } else {
        setBooking(bookingResult.data as unknown as ThreadBooking);
        setMessages((messagesResult.data ?? []).map((row) => toThreadMessage(row)));
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [bookingId, user]);

  const appendMessage = useCallback((incoming: ThreadMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === incoming.id)) return prev;
      // Our own insert echoes back over realtime carrying the server id. Swap it in over
      // the optimistic row rather than appending the same message a second time.
      const optimisticIndex = prev.findIndex(
        (m) => m.pending && m.sender_id === incoming.sender_id && m.body === incoming.body
      );
      if (optimisticIndex !== -1) {
        const next = prev.slice();
        next[optimisticIndex] = { ...incoming, key: prev[optimisticIndex].key };
        return next;
      }
      return [...prev, incoming];
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          // Realtime rows are flat — no sender join. partyFor() resolves the name from the booking.
          appendMessage(toThreadMessage({ ...payload.new, sender: null }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, appendMessage]);

  const messageCount = messages.length;

  useEffect(() => {
    if (loading || loadError) return;
    if (document.hidden) return;
    void markThreadReadRef.current(bookingId);
  }, [bookingId, messageCount, loading, loadError]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) void markThreadReadRef.current(bookingId);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [bookingId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || loading) return;
    el.scrollTo({ top: el.scrollHeight, behavior: hasScrolledRef.current ? "smooth" : "auto" });
    hasScrolledRef.current = true;
  }, [messageCount, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [draft]);

  const partyFor = useCallback(
    (senderId: string): ThreadParty | null => {
      if (!booking) return null;
      if (booking.owner && booking.owner.id === senderId) return booking.owner;
      if (booking.sitter && booking.sitter.id === senderId) return booking.sitter;
      return null;
    },
    [booking]
  );

  const profileFor = (m: ThreadMessage) => m.sender ?? partyFor(m.sender_id);
  const nameFor = (m: ThreadMessage) => profileFor(m)?.full_name?.trim() || t("messages.unknownPerson");

  const dayLabel = (iso: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((today - startOfDay(iso)) / 86_400_000);
    if (diffDays === 0) return t("messages.today");
    if (diffDays === 1) return t("messages.yesterday");
    return formatDate(iso, locale);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !user || sending) return;

    const optimisticId = `optimistic-${Date.now()}-${optimisticSeq++}`;
    const optimistic: ThreadMessage = {
      id: optimisticId,
      key: optimisticId,
      booking_id: bookingId,
      sender_id: user.id,
      kind: "user",
      body,
      event: null,
      created_at: new Date().toISOString(),
      sender: partyFor(user.id),
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);
    setSendError(null);

    // Insert only — a trigger writes the notification.
    const { data, error } = await supabase
      .from("messages")
      .insert({ booking_id: bookingId, sender_id: user.id, kind: "user", body })
      .select(MESSAGE_SELECT)
      .single();

    setSending(false);

    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft((current) => current || body);
      setSendError(t("messages.sendFailed"));
      return;
    }

    const saved = toThreadMessage(data, optimisticId);
    setMessages((prev) => {
      // The realtime echo may have already claimed the optimistic slot.
      if (prev.some((m) => m.id === saved.id)) {
        return prev.some((m) => m.id === optimisticId) ? prev.filter((m) => m.id !== optimisticId) : prev;
      }
      return prev.map((m) => (m.id === optimisticId ? { ...saved, key: m.key } : m));
    });
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100dvh-3.5rem)] lg:h-[100dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("messages.back")}
        </Link>
        <EmptyState
          icon={loadError === "failed" ? TriangleAlert : MessageCircleOff}
          title={loadError === "failed" ? t("messages.loadFailed") : t("messages.notAParty")}
          tone="error"
        />
      </div>
    );
  }

  const counterparty = booking.owner_id === user?.id ? booking.sitter : booking.owner;
  const counterpartyName = counterparty?.full_name?.trim() || t("messages.unknownPerson");
  const headerTitle = t("messages.threadHeaderWith", { name: counterpartyName });
  const petName = booking.pet?.name ?? t("messages.notifications.fallbackPet");
  const status = STATUS_CONFIG[booking.status];

  return (
    <div className="h-[calc(100dvh-3.5rem)] lg:h-[100dvh] flex flex-col">
      <header className="flex-shrink-0 border-b border-black/5 bg-surface/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-3">
          <Link
            href="/messages"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("messages.back")}
          </Link>
          <Link href="/bookings" className="group mt-2 flex items-center gap-3">
            <Avatar name={counterpartyName} url={counterparty?.avatar_url} size="md" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base sm:text-lg font-bold text-ink truncate transition-colors group-hover:text-brand-strong">
                {headerTitle}
              </h1>
              <p className="text-xs text-ink-soft truncate">
                {t("messages.threadAboutPet", { pet: petName, service: t(`common.services.${booking.service}`) })}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                status?.color
              )}
            >
              {t(`common.bookingStatus.${booking.status}`)}
            </span>
          </Link>
        </div>
      </header>

      <div ref={listRef} role="log" aria-live="polite" aria-label={headerTitle} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">
          {messages.map((m, i) => {
            const previous = i > 0 ? messages[i - 1] : null;
            const startsDay = !previous || startOfDay(previous.created_at) !== startOfDay(m.created_at);
            const divider = startsDay ? <DayDivider label={dayLabel(m.created_at)} /> : null;

            if (m.kind === "system") {
              if (!m.event) return null;
              return (
                <div key={m.key}>
                  {divider}
                  <div className="flex items-center gap-3 py-3">
                    <span className="flex-1 h-px bg-black/5" />
                    <span className="text-xs text-ink-soft text-center">
                      {t(`messages.systemEvent.${m.event}`, { actor: nameFor(m) })}
                    </span>
                    <span className="flex-1 h-px bg-black/5" />
                  </div>
                </div>
              );
            }

            const own = m.sender_id === user?.id;
            const startsRun =
              startsDay || !previous || previous.kind === "system" || previous.sender_id !== m.sender_id;
            // The day divider brings its own vertical rhythm, so bubbles under one add no margin.
            const spacing = !previous || startsDay ? "" : startsRun ? "mt-3" : "mt-1";

            return (
              <div key={m.key}>
                {divider}
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className={cn("flex items-end gap-2", own ? "justify-end" : "justify-start", spacing)}
                >
                  {!own &&
                    (startsRun ? (
                      <Avatar name={nameFor(m)} url={profileFor(m)?.avatar_url} size="sm" />
                    ) : (
                      <span aria-hidden className="w-8 flex-shrink-0" />
                    ))}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words",
                      own ? "bg-brand text-white" : "bg-surface-2 text-ink",
                      m.pending && "opacity-70"
                    )}
                  >
                    {m.body}
                    <span
                      className={cn("block mt-1 text-[11px] tabular-nums", own ? "text-white/70" : "text-ink-soft")}
                    >
                      {formatTime(m.created_at, locale)}
                    </span>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-black/5 bg-surface/80 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-3">
          {sendError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-danger mb-2">
              <TriangleAlert className="w-4 h-4 flex-shrink-0" />
              {sendError}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              enterKeyHint="send"
              placeholder={t("messages.composerPlaceholder")}
              aria-label={t("messages.composerPlaceholder")}
              className={cn(INPUT_CLASS, "h-auto min-h-[2.75rem] max-h-40 py-3 leading-6 resize-none overflow-y-auto")}
            />
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              aria-label={t("messages.send")}
              title={t("messages.send")}
              className="h-11 w-11 flex-shrink-0 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
