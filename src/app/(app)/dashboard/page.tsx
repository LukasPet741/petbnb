"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, PawPrint, CalendarDays, Clock, CheckCircle2, Plus, Bookmark, Dog, Cat } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFavorites } from "@/context/FavoritesContext";
import { useLanguage } from "@/context/LanguageContext";
import Avatar from "@/components/Avatar";
import SitterMini from "@/components/SitterMini";
import TipWidget from "@/components/TipWidget";
import EmptyState from "@/components/EmptyState";
import { STATUS_CONFIG, type Profile } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/motion";

interface Pet { id: string; name: string; type: string; photo_url: string | null; }
interface Booking { id: string; status: string; service: string; start_at: string; sitter: { id: string; full_name: string | null; avatar_url: string | null } | null; pet: { id: string; name: string } | null; }

const BANNER = "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1200&h=400&q=80";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function relativeDate(iso: string, t: Translate, locale: "en" | "lt"): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return t("appShell.dashboard.summary.relativeToday");
  if (days === 1) return t("appShell.dashboard.summary.relativeTomorrow");
  if (days < 7) return t("appShell.dashboard.summary.relativeInDays", { days });
  return t("appShell.dashboard.summary.relativeOnDate", { date: formatDate(iso, locale) });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { count: savedCount } = useFavorites();
  const { t, locale } = useLanguage();
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sitters, setSitters] = useState<Profile[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("pets").select("id,name,type,photo_url").eq("owner_id", user.id).order("created_at").then(({ data }) => setPets((data as Pet[]) ?? []));
    supabase.from("bookings").select("id,status,service,start_at, sitter:profiles!bookings_sitter_id_fkey(id,full_name,avatar_url), pet:pets(id,name)").eq("owner_id", user.id).order("start_at").then(({ data }) => setBookings((data as unknown as Booking[]) ?? []));
    supabase.from("profiles").select("*").eq("is_sitter", true).neq("id", user.id).order("experience_years", { ascending: false }).limit(8).then(({ data }) => setSitters((data as Profile[]) ?? []));
  }, [user]);

  const pending = bookings.filter((b) => b.status === "pending").length;
  const upcoming = bookings.filter((b) => b.status === "signed").length;
  const firstName = profile?.full_name?.split(" ")[0] ?? t("appShell.dashboard.fallbackName");
  const hour = new Date().getHours();
  const greeting =
    hour < 5 || hour >= 22
      ? t("appShell.dashboard.greeting.night")
      : hour < 12
      ? t("appShell.dashboard.greeting.morning")
      : hour < 18
      ? t("appShell.dashboard.greeting.afternoon")
      : t("appShell.dashboard.greeting.evening");

  const nearby = [...sitters]
    .sort((a, b) => (a.city === profile?.city ? 0 : 1) - (b.city === profile?.city ? 0 : 1))
    .slice(0, 4);

  const stats = [
    { icon: PawPrint, label: pets.length === 1 ? t("appShell.dashboard.stats.pet") : t("appShell.dashboard.stats.pets"), value: pets.length, color: "text-brand bg-brand-soft", href: "/pets" },
    { icon: Clock, label: t("appShell.dashboard.stats.pending"), value: pending, color: "text-amber-strong bg-amber-soft", href: "/bookings" },
    { icon: CheckCircle2, label: t("appShell.dashboard.stats.confirmed"), value: upcoming, color: "text-brand bg-brand-soft", href: "/bookings" },
  ];

  const nextSigned = bookings.find((b) => b.status === "signed" && new Date(b.start_at).getTime() > Date.now());

  const summary = pending
    ? t(pending !== 1 ? "appShell.dashboard.summary.pendingPlural" : "appShell.dashboard.summary.pending", { pending })
    : nextSigned
    ? t("appShell.dashboard.summary.nextBooking", {
        pet: nextSigned.pet?.name ?? t("appShell.dashboard.fallbackPetName"),
        when: relativeDate(nextSigned.start_at, t, locale),
      })
    : t("appShell.dashboard.summary.empty");

  const upcomingServices = bookings
    .filter((b) => b.status === "signed" && new Date(b.start_at).getTime() > Date.now())
    .map((b) => b.service);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      {/* Welcome banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-2xl shadow-[var(--shadow-lg),inset_0_1px_0_rgb(255_255_255_/_0.5),inset_0_0_0_1px_rgb(31_92_71_/_0.08)]">
        <img src={BANNER} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/55 to-ink/10" />
        <div className="relative p-7 sm:p-9 min-h-[150px] flex items-center gap-4">
          <Avatar name={profile?.full_name ?? t("appShell.sidebar.youFallback")} url={profile?.avatar_url} size="lg" className="glass-chip text-white ring-2 ring-white/50 hidden sm:flex" />
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight">{greeting}, {firstName}</h1>
            <p className="text-white/80 text-sm mt-1.5">{summary}</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div className="grid grid-cols-3 gap-3 sm:gap-5" variants={stagger(0.08)} initial="hidden" animate="show">
        {stats.map(({ icon: Icon, label, value, color, href }) => (
          <motion.div key={label} variants={fadeUp}>
            <Link href={href} className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-4 sm:p-6 block hover:shadow-[var(--shadow-md)] transition-shadow h-full">
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-3 sm:mb-4 ${color}`}><Icon className="w-5 h-5" /></div>
              <div className="font-display text-3xl font-semibold text-ink leading-none">{value}</div>
              <div className="text-sm text-ink-soft mt-1.5">{label}</div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Body: main + right column */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem] gap-8 lg:gap-10">
        {/* Main */}
        <div className="space-y-10 min-w-0">
          {/* Bookings */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink tracking-tight">{t("appShell.dashboard.bookings.heading")}</h2>
              {bookings.length > 0 && <Link href="/bookings" className="text-sm text-brand font-medium hover:gap-2 inline-flex items-center gap-1 transition-all">{t("appShell.dashboard.bookings.viewAll")} <ArrowRight className="w-3.5 h-3.5" /></Link>}
            </div>
            {bookings.length === 0 ? (
              <EmptyState icon={CalendarDays} title={t("appShell.dashboard.bookings.emptyTitle")} description={t("appShell.dashboard.bookings.emptyDescription")}
                action={<Link href="/browse" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">{t("appShell.findASitter")} <ArrowRight className="w-4 h-4" /></Link>} />
            ) : (
              <motion.div className="space-y-3.5" variants={stagger(0.07)} initial="hidden" animate="show">
                {bookings.slice(0, 3).map((booking) => {
                  const status = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG];
                  return (
                    <motion.div key={booking.id} variants={fadeUp} className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-5 flex items-center gap-4 hover:shadow-[var(--shadow-md)] transition-shadow">
                      <Avatar name={booking.sitter?.full_name ?? t("appShell.sitterFallback")} url={booking.sitter?.avatar_url} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-ink text-sm">{booking.sitter?.full_name}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? ""}`}>{t(`common.bookingStatus.${booking.status}`)}</span>
                        </div>
                        <div className="text-sm text-ink-soft mt-1">{t(`common.services.${booking.service}`)} · {booking.pet?.name}</div>
                        <div className="flex items-center gap-1 text-xs text-ink-soft/70 mt-1.5"><Clock className="w-3 h-3" />{formatDate(booking.start_at, locale)}</div>
                      </div>
                      <Link href="/bookings" className="text-sm text-brand font-medium hover:underline flex-shrink-0">{t("appShell.dashboard.bookings.details")}</Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </section>

          {/* Sitters near you */}
          {nearby.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-ink tracking-tight">{t("appShell.dashboard.sittersNearYou.heading")}</h2>
                <Link href="/browse" className="text-sm text-brand font-medium hover:gap-2 inline-flex items-center gap-1 transition-all">{t("appShell.dashboard.sittersNearYou.seeAll")} <ArrowRight className="w-3.5 h-3.5" /></Link>
              </div>
              <motion.div className="grid sm:grid-cols-2 gap-3" variants={stagger(0.06)} initial="hidden" animate="show">
                {nearby.map((s) => <motion.div key={s.id} variants={fadeUp}><SitterMini sitter={s} /></motion.div>)}
              </motion.div>
            </section>
          )}
        </div>

        {/* Right column */}
        <motion.aside className="space-y-6" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.15 }}>
          {/* Your pets */}
          <div className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">{t("appShell.dashboard.pets.heading")}</h3>
              <Link href="/pets/new" className="text-ink-soft hover:text-brand transition-colors" title={t("appShell.dashboard.pets.addPetTitle")}><Plus className="w-4 h-4" /></Link>
            </div>
            {pets.length === 0 ? (
              <Link href="/pets/new" className="flex items-center gap-2 text-sm text-brand font-medium"><Plus className="w-4 h-4" />{t("appShell.dashboard.pets.addFirstPet")}</Link>
            ) : (
              <div className="space-y-2.5">
                {pets.slice(0, 4).map((pet) => (
                  <Link key={pet.id} href="/pets" className="flex items-center gap-3 group">
                    {pet.photo_url
                      ? <img src={pet.photo_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-9 h-9 rounded-lg object-cover ring-1 ring-black/5 flex-shrink-0" />
                      : <span className="w-9 h-9 rounded-lg bg-brand-soft flex items-center justify-center flex-shrink-0">{pet.type === "cat" ? <Cat className="w-4 h-4 text-brand" /> : <Dog className="w-4 h-4 text-brand" />}</span>}
                    <span className="text-sm font-medium text-ink truncate group-hover:text-brand transition-colors">{pet.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Saved teaser */}
          <Link href="/saved" className="block bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-5 hover:shadow-[var(--shadow-md)] transition-shadow group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0"><Bookmark className="w-5 h-5 text-rose-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink">{t("appShell.dashboard.saved.heading")}</div>
                <div className="text-xs text-ink-soft mt-0.5">{savedCount > 0 ? t("appShell.dashboard.saved.count", { count: savedCount }) : t("appShell.dashboard.saved.empty")}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-ink-soft/40 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>

          {/* Tip */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-ink">{t("appShell.petCareTip")}</h3>
            <TipWidget pets={pets} upcomingServices={upcomingServices} />
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
