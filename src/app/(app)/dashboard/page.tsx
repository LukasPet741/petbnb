"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, PawPrint, CalendarDays, Search, Plus, TrendingUp, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import Avatar from "@/components/Avatar";
import PetCard from "@/components/PetCard";
import { STATUS_CONFIG, SERVICE_LABELS } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/motion";

interface Pet { id: string; name: string; type: string; sex: string | null; weight_kg: number | null; bio: string | null; photo_url: string | null; owner_id: string; created_at: string; }
interface Booking { id: string; status: string; service: string; start_at: string; end_at: string; notes: string | null; address: string | null; sitter: { id: string; full_name: string | null; avatar_url: string | null; rate_per_hour: number | null } | null; pet: { id: string; name: string } | null; }

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at").then(({ data }) => setPets(data ?? []));
    supabase.from("bookings").select("*, sitter:profiles!bookings_sitter_id_fkey(id,full_name,avatar_url,rate_per_hour), pet:pets(id,name)").eq("owner_id", user.id).order("start_at").then(({ data }) => setBookings((data as unknown as Booking[]) ?? []));
  }, [user]);

  const pending = bookings.filter((b) => b.status === "pending").length;
  const upcoming = bookings.filter((b) => b.status === "signed").length;
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <motion.div className="flex items-center justify-between gap-4" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-4">
          <Avatar name={profile?.full_name ?? "You"} url={profile?.avatar_url} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Good morning, {firstName} 👋</h1>
            <p className="text-stone-500 text-sm mt-0.5">Here&apos;s what&apos;s happening with your pets today.</p>
          </div>
        </div>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="hidden sm:block">
          <Link href="/bookings/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#D95F3B] text-white rounded-xl text-sm font-medium hover:bg-[#c4482a] transition-colors">
            <Plus className="w-4 h-4" />New booking
          </Link>
        </motion.div>
      </motion.div>

      {/* Stats */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={stagger(0.07)} initial="hidden" animate="show">
        {[
          { icon: PawPrint, label: "My pets", value: pets.length, color: "text-[#D95F3B] bg-orange-50", href: "/pets" },
          { icon: CalendarDays, label: "Pending", value: pending, color: "text-amber-600 bg-amber-50", href: "/bookings" },
          { icon: TrendingUp, label: "Upcoming", value: upcoming, color: "text-green-600 bg-green-50", href: "/bookings" },
          { icon: Search, label: "Browse sitters", value: "Find", color: "text-blue-600 bg-blue-50", href: "/browse" },
        ].map(({ icon: Icon, label, value, color, href }) => (
          <motion.div key={label} variants={fadeUp}>
            <motion.div whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} transition={{ type: "spring", stiffness: 300 }}>
              <Link href={href} className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 block">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}><Icon className="w-5 h-5" /></div>
                <div className="text-2xl font-bold text-stone-900">{value}</div>
                <div className="text-sm text-stone-500 mt-0.5">{label}</div>
              </Link>
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bookings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Upcoming bookings</h2>
            <Link href="/bookings" className="text-sm text-[#D95F3B] hover:underline flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
          {bookings.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border border-stone-100 p-8 text-center">
              <CalendarDays className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 text-sm">No bookings yet.</p>
              <Link href="/browse" className="text-[#D95F3B] text-sm font-medium hover:underline mt-1 inline-block">Browse sitters →</Link>
            </motion.div>
          ) : (
            <motion.div className="space-y-3" variants={stagger(0.07)} initial="hidden" animate="show">
              {bookings.slice(0, 5).map((booking) => {
                const status = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG];
                return (
                  <motion.div key={booking.id} variants={fadeUp} whileHover={{ x: 3 }} transition={{ type: "spring", stiffness: 300 }}
                    className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 flex items-center gap-4">
                    <Avatar name={booking.sitter?.full_name ?? "Sitter"} url={booking.sitter?.avatar_url} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-stone-900 text-sm">{booking.sitter?.full_name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? "bg-stone-100 text-stone-600"}`}>{status?.label ?? booking.status}</span>
                      </div>
                      <div className="text-sm text-stone-500 mt-0.5">{SERVICE_LABELS[booking.service as keyof typeof SERVICE_LABELS]} · {booking.pet?.name}</div>
                      <div className="flex items-center gap-1 text-xs text-stone-400 mt-1"><Clock className="w-3 h-3" />{formatDate(booking.start_at)}</div>
                    </div>
                    <Link href="/bookings" className="text-sm text-[#D95F3B] font-medium hover:underline flex-shrink-0">Details</Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <motion.div className="space-y-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.2 }}>
          <h2 className="text-lg font-semibold text-stone-900">Quick actions</h2>
          <div className="space-y-2">
            {[
              { href: "/browse", icon: Search, label: "Find a sitter", desc: "Browse and filter sitters" },
              { href: "/pets/new", icon: Plus, label: "Add a pet", desc: "Register a new pet" },
              { href: "/bookings/new", icon: CalendarDays, label: "Book now", desc: "Create a new booking" },
            ].map(({ href, icon: Icon, label, desc }, i) => (
              <motion.div key={href} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }}
                whileHover={{ x: 4 }}>
                <Link href={href} className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 flex items-center gap-3 group">
                  <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center"><Icon className="w-4 h-4 text-[#D95F3B]" /></div>
                  <div className="flex-1"><div className="text-sm font-medium text-stone-900">{label}</div><div className="text-xs text-stone-400">{desc}</div></div>
                  <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-[#D95F3B] transition-colors" />
                </Link>
              </motion.div>
            ))}
          </div>
          {pets.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-stone-900">My pets</h2>
                <Link href="/pets" className="text-sm text-[#D95F3B] hover:underline">View all</Link>
              </div>
              <div className="space-y-3">
                {pets.slice(0, 3).map((pet) => <PetCard key={pet.id} pet={pet as Parameters<typeof PetCard>[0]["pet"]} />)}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
