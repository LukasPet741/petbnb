"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { type BookingStatus } from "@/lib/types";
import BookingCard from "@/components/BookingCard";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RightRail from "@/components/RightRail";
import { stagger, fadeUp } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";

interface Booking {
  id: string; status: string; service: string; start_at: string; end_at: string; notes: string | null; address: string | null;
  sitter: { id: string; full_name: string | null; avatar_url: string | null; rate_per_hour: number | null } | null;
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null;
  pet: { id: string; name: string; photo_url: string | null } | null;
}

const TAB_VALUES: ("all" | BookingStatus)[] = ["all", "pending", "signed", "completed"];

export default function BookingsPage() {
  const { t } = useLanguage();
  const TABS: { label: string; value: "all" | BookingStatus }[] = TAB_VALUES.map((value) => ({
    value,
    label: value === "all" ? t("appPages.bookings.tabAll") : t(`common.bookingStatus.${value}`),
  }));
  const { user } = useAuth();
  const { profile } = useProfile();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | BookingStatus>("all");

  const load = async () => {
    if (!user) return;
    const q = supabase.from("bookings").select("*, sitter:profiles!bookings_sitter_id_fkey(id,full_name,avatar_url,rate_per_hour), owner:profiles!bookings_owner_id_fkey(id,full_name,avatar_url), pet:pets(id,name,photo_url)");
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
      <PageHeader title={t("appPages.bookings.title")} subtitle={loading ? t("appPages.bookings.loadingText") : bookings.length !== 1 ? t("appPages.bookings.countPlural", { count: bookings.length }) : t("appPages.bookings.countSingular", { count: bookings.length })} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem] gap-8 lg:gap-10">
        <div className="min-w-0">
          {/* Tabs */}
          <div className="flex gap-1 bg-surface-2 rounded-xl p-1 mb-8">
            {TABS.map(({ label, value }) => (
              <button key={value} onClick={() => setTab(value)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors relative ${tab === value ? "text-ink" : "text-ink-soft hover:text-ink"}`}>
                {tab === value && (
                  <motion.div layoutId="tab-pill" className="absolute inset-0 bg-surface rounded-lg shadow-[var(--shadow-sm)]" style={{ zIndex: -1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                {label}
              </button>
            ))}
          </div>

          {!loading && filtered.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={tab === "all" ? t("appPages.bookings.emptyTitleAll") : t("appPages.bookings.emptyTitleFiltered", { status: t(`common.bookingStatusGenitive.${tab}`) })}
              description={tab === "all" ? t("appPages.bookings.emptyDescriptionAll") : undefined}
              action={tab === "all" ? <Link href="/browse" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors"><Search className="w-4 h-4" />{t("appPages.bookings.findSitterButton")}</Link> : undefined}
            />
          ) : (
            <motion.div className="space-y-4" variants={stagger(0.07)} initial="hidden" animate="show">
              <AnimatePresence mode="popLayout">
                {filtered.map((booking) => {
                  const isSitterView = Boolean(profile?.is_sitter && booking.sitter?.id === user?.id);
                  const displayProfile = isSitterView ? booking.owner : booking.sitter;
                  const displayLabel = isSitterView ? t("appPages.bookings.ownerLabel") : t("appPages.bookings.sitterLabel");
                  return (
                    <motion.div key={booking.id} variants={fadeUp}>
                      <BookingCard
                        booking={booking}
                        isSitterView={isSitterView}
                        displayProfile={displayProfile}
                        displayLabel={displayLabel}
                        onCancel={() => handleCancel(booking.id)}
                        onAccept={() => handleUpdateStatus(booking.id, "signed")}
                        onDecline={() => handleUpdateStatus(booking.id, "declined")}
                        onMarkCompleted={() => handleUpdateStatus(booking.id, "completed")}
                      />
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
