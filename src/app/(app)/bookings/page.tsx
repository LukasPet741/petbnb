"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { STATUS_CONFIG, SERVICE_LABELS, type BookingStatus } from "@/lib/types";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RightRail from "@/components/RightRail";
import { formatDate } from "@/lib/utils";
import { stagger, fadeUp } from "@/lib/motion";

interface Booking {
  id: string; status: string; service: string; start_at: string; end_at: string; notes: string | null; address: string | null;
  sitter: { id: string; full_name: string | null; avatar_url: string | null; rate_per_hour: number | null } | null;
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null;
  pet: { id: string; name: string } | null;
}

const TABS: { label: string; value: "all" | BookingStatus }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "signed" },
  { label: "Completed", value: "completed" },
];

export default function BookingsPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | BookingStatus>("all");

  const load = async () => {
    if (!user) return;
    const q = supabase.from("bookings").select("*, sitter:profiles!bookings_sitter_id_fkey(id,full_name,avatar_url,rate_per_hour), owner:profiles!bookings_owner_id_fkey(id,full_name,avatar_url), pet:pets(id,name)");
    const { data } = profile?.is_sitter
      ? await q.or(`owner_id.eq.${user.id},sitter_id.eq.${user.id}`).order("start_at")
      : await q.eq("owner_id", user.id).order("start_at");
    setBookings((data as unknown as Booking[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (profile !== undefined) load(); }, [user, profile]);

  const filtered = tab === "all" ? bookings : bookings.filter((b) => b.status === tab);

  const handleCancel = async (id: string) => {
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "cancelled" } : b));
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader title="Bookings" subtitle={loading ? "Loading…" : `${bookings.length} booking${bookings.length !== 1 ? "s" : ""} in total`} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem] gap-8 lg:gap-10">
        <div className="min-w-0">
          {/* Tabs */}
          <div className="flex gap-1 bg-surface-2 rounded-xl p-1 mb-8">
            {TABS.map(({ label, value }) => (
              <button key={value} onClick={() => setTab(value)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors relative ${tab === value ? "text-ink" : "text-ink-soft hover:text-ink"}`}>
                {tab === value && (
                  <motion.div layoutId="tab-pill" className="absolute inset-0 bg-surface rounded-lg shadow-sm" style={{ zIndex: -1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                {label}
              </button>
            ))}
          </div>

          {!loading && filtered.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={tab === "all" ? "No bookings yet" : `No ${TABS.find((t) => t.value === tab)?.label.toLowerCase()} bookings`}
              description={tab === "all" ? "When you book a sitter, your requests will show up here." : undefined}
              action={tab === "all" ? <Link href="/browse" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors"><Search className="w-4 h-4" />Find a sitter</Link> : undefined}
            />
          ) : (
            <motion.div className="space-y-4" variants={stagger(0.07)} initial="hidden" animate="show">
              <AnimatePresence mode="popLayout">
                {filtered.map((booking) => {
                  const status = STATUS_CONFIG[booking.status as BookingStatus];
                  const isSitterView = profile?.is_sitter && booking.sitter?.id === user?.id;
                  const displayProfile = isSitterView ? booking.owner : booking.sitter;
                  const displayLabel = isSitterView ? "Owner" : "Sitter";
                  return (
                    <motion.div key={booking.id} variants={fadeUp} layout exit={{ opacity: 0, scale: 0.97 }}
                      className="bg-surface rounded-2xl border border-black/5 shadow-sm p-5 sm:p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        <Avatar name={displayProfile?.full_name ?? "User"} url={displayProfile?.avatar_url} size="lg" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-ink">{displayProfile?.full_name}</h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status?.color ?? ""}`}>{status?.label ?? booking.status}</span>
                          </div>
                          <p className="text-sm text-ink-soft mt-1">
                            <span className="text-ink-soft/70">{displayLabel} · </span>
                            {SERVICE_LABELS[booking.service as keyof typeof SERVICE_LABELS]} · {booking.pet?.name}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                            <span className="flex items-center gap-1.5 text-xs text-ink-soft"><Clock className="w-3.5 h-3.5" />{formatDate(booking.start_at)} → {formatDate(booking.end_at)}</span>
                            {booking.address && <span className="flex items-center gap-1.5 text-xs text-ink-soft"><MapPin className="w-3.5 h-3.5" />{booking.address}</span>}
                          </div>
                          {booking.notes && <p className="text-sm text-ink-soft/80 mt-3 italic">&ldquo;{booking.notes}&rdquo;</p>}
                          {!isSitterView && booking.status === "pending" && (
                            <div className="flex gap-2 mt-4 pt-4 border-t border-black/5">
                              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleCancel(booking.id)}
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">Cancel request</motion.button>
                            </div>
                          )}
                          {isSitterView && booking.status === "pending" && (
                            <div className="flex gap-2 mt-4 pt-4 border-t border-black/5">
                              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleUpdateStatus(booking.id, "signed")}
                                className="px-4 py-2 bg-brand-soft text-brand-strong rounded-lg text-xs font-medium hover:brightness-95 transition-all">Accept</motion.button>
                              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleUpdateStatus(booking.id, "declined")}
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">Decline</motion.button>
                            </div>
                          )}
                          {isSitterView && booking.status === "signed" && (
                            <div className="flex gap-2 mt-4 pt-4 border-t border-black/5">
                              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleUpdateStatus(booking.id, "completed")}
                                className="px-4 py-2 bg-sky-50 text-sky-700 rounded-lg text-xs font-medium hover:bg-sky-100 transition-colors">Mark completed</motion.button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <RightRail showNextBooking={false} />
      </div>
    </div>
  );
}
