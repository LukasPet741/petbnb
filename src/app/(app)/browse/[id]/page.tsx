"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Clock, ArrowLeft, Calendar, Check } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { SERVICE_LABELS, type ServiceType, type Profile } from "@/lib/types";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import FavoriteButton from "@/components/FavoriteButton";

export default function SitterProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [sitter, setSitter] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", id).single().then(({ data }) => {
      setSitter(data as Profile);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  if (!sitter) return <div className="max-w-4xl mx-auto px-4 py-16 text-center"><p className="text-ink-soft">Sitter not found.</p><Link href="/browse" className="text-brand hover:underline mt-2 inline-block">Back to browse</Link></div>;

  const activeServices = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][]).filter(([, v]) => v).map(([k]) => ({ key: k, label: SERVICE_LABELS[k] }));
  const firstName = sitter.full_name?.split(" ")[0] ?? "this sitter";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link href="/browse" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to browse
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="bg-surface rounded-2xl border border-black/5 shadow-sm p-6">
            <div className="flex items-start gap-5">
              <Avatar name={sitter.full_name ?? "Sitter"} url={sitter.avatar_url} size="xl" />
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">{sitter.full_name}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-ink-soft">
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{sitter.city}</span>
                  {sitter.experience_years != null && (
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{sitter.experience_years} yr{sitter.experience_years !== 1 ? "s" : ""} experience</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-4">{activeServices.map(({ key, label }) => <Badge key={key} variant="brand">{label}</Badge>)}</div>
              </div>
              <FavoriteButton sitterId={sitter.id} />
            </div>
            {sitter.about_me && (
              <div className="mt-6 pt-6 border-t border-black/5">
                <h2 className="font-semibold text-ink mb-2">About {firstName}</h2>
                <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-line">{sitter.about_me}</p>
              </div>
            )}
          </motion.div>

          {/* Services & rate */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
            className="bg-surface rounded-2xl border border-black/5 shadow-sm p-6">
            <h2 className="font-semibold text-ink mb-4">Services offered</h2>
            {activeServices.length === 0 ? (
              <p className="text-sm text-ink-soft">This sitter hasn&apos;t listed any services yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeServices.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between p-3.5 bg-canvas rounded-xl border border-black/5">
                    <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
                      <span className="w-6 h-6 rounded-lg bg-brand-soft flex items-center justify-center"><Check className="w-3.5 h-3.5 text-brand" /></span>
                      {label}
                    </span>
                    {sitter.rate_per_hour != null && <span className="text-sm text-ink-soft">€{sitter.rate_per_hour}/hr</span>}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Booking sidebar */}
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
            className="bg-surface rounded-2xl border border-black/5 shadow-sm p-5 sticky top-24">
            <div className="text-center pb-4 border-b border-black/5">
              <div className="font-display text-3xl font-semibold text-ink">€{sitter.rate_per_hour ?? "—"}</div>
              <div className="text-sm text-ink-soft mt-0.5">per hour</div>
            </div>
            <div className="pt-4 space-y-3">
              <Link href={`/bookings/new?sitter=${sitter.id}`} className="flex items-center justify-center gap-2 w-full h-11 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors">
                <Calendar className="w-4 h-4" />Book {firstName}
              </Link>
              <p className="text-xs text-ink-soft/80 text-center">You won&apos;t be charged yet — the sitter confirms first.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
