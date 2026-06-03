"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, CalendarDays, Clock, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { STATUS_CONFIG, SERVICE_LABELS, type BookingStatus } from "@/lib/mock-data";
import Avatar from "@/components/Avatar";
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div className="flex items-center justify-between mb-6" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Bookings</h1>
          <p className="text-stone-500 text-sm mt-0.5">{loading ? "Loading…" : `${bookings.length} total`}</p>
        </div>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Link href="/bookings/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#D95F3B] text-white rounded-xl text-sm font-medium hover:bg-[#c4482a] transition-colors">
            <Plus className="w-4 h-4" />New booking
          </Link>
        </motion.div>
      </motion.div>

      {/* Tabs */}
      <motion.div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        {TABS.map(({ label, value }) => (
          <button key={value} onClick={() => setTab(value)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors relative ${tab === value ? "text-stone-900" : "text-stone-500 hover:text-stone-700"}`}>
            {tab === value && (
              <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" style={{ zIndex: -1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
            {label}
          </button>
        ))}
      </motion.div>

      {!loading && filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border border-stone-100 p-12 text-center">
          <CalendarDays className="w-12 h-12 text-stone-200 mx-auto mb-4" />
          <p className="text-stone-500 font-medium">No bookings here</p>
          <Link href="/browse" className="text-[#D95F3B] text-sm font-medium hover:underline mt-2 inline-block">Browse sitters →</Link>
        </motion.div>
      ) : (
        <motion.div className="space-y-4" variants={stagger(0.07)} initial="hidden" animate="show">
          <AnimatePresence mode="popLayout">
            {filtered.map((booking) => {
              const status = STATUS_CONFIG[booking.status as BookingStatus];
              const isSitterView = profile?.is_sitter && booking.sitter?.id === user?.id;
              const displayProfile = isSitterView ? booking.owner : booking.sitter;
              const displayLabel = isSitterView ? "From" : "With";
              return (
                <motion.div key={booking.id} variants={fadeUp} layout exit={{ opacity: 0, scale: 0.97 }}
                  className="bg-white rounded-xl border border-stone-100 shadow-sm p-5"
                  whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.07)" }}>
                  <div className="flex items-start gap-4">
                    <Avatar name={displayProfile?.full_name ?? "User"} url={displayProfile?.avatar_url} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-400">{displayLabel}:</span>
                            <h3 className="font-semibold text-stone-900">{displayProfile?.full_name}</h3>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status?.color ?? "bg-stone-100 text-stone-600"}`}>{status?.label ?? booking.status}</span>
                          </div>
                          <p className="text-sm text-stone-500 mt-0.5">{SERVICE_LABELS[booking.service as keyof typeof SERVICE_LABELS]} · {booking.pet?.name}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-3">
                        <span className="flex items-center gap-1.5 text-xs text-stone-500"><Clock className="w-3.5 h-3.5" />{formatDate(booking.start_at)} → {formatDate(booking.end_at)}</span>
                        {booking.address && <span className="flex items-center gap-1.5 text-xs text-stone-500"><MapPin className="w-3.5 h-3.5" />{booking.address}</span>}
                      </div>
                      {booking.notes && <p className="text-xs text-stone-400 mt-2 italic">&ldquo;{booking.notes}&rdquo;</p>}
                      {!isSitterView && booking.status === "pending" && (
                        <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => handleCancel(booking.id)}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
                            Cancel
                          </motion.button>
                        </div>
                      )}
                      {isSitterView && booking.status === "pending" && (
                        <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => handleUpdateStatus(booking.id, "signed")}
                            className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors">Accept</motion.button>
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => handleUpdateStatus(booking.id, "declined")}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">Decline</motion.button>
                        </div>
                      )}
                      {isSitterView && booking.status === "signed" && (
                        <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
                          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => handleUpdateStatus(booking.id, "completed")}
                            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">Mark completed</motion.button>
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
  );
}
