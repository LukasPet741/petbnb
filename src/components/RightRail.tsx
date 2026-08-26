"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Avatar from "./Avatar";
import SitterMini from "./SitterMini";
import TipWidget from "./TipWidget";
import { STATUS_CONFIG, type BookingStatus, type Profile } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface NextBooking {
  id: string; status: string; start_at: string;
  sitter: { full_name: string | null; avatar_url: string | null } | null;
}

export default function RightRail({ showNextBooking = true }: { showNextBooking?: boolean }) {
  const { user } = useAuth();
  const [next, setNext] = useState<NextBooking | null>(null);
  const [spotlight, setSpotlight] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    if (showNextBooking) {
      supabase.from("bookings")
        .select("id,status,start_at, sitter:profiles!bookings_sitter_id_fkey(full_name,avatar_url)")
        .eq("owner_id", user.id).in("status", ["pending", "signed"]).gte("start_at", new Date().toISOString())
        .order("start_at").limit(1)
        .then(({ data }) => setNext((data?.[0] as unknown as NextBooking) ?? null));
    }
    supabase.from("profiles").select("*").eq("is_sitter", true).not("avatar_url", "is", null)
      .order("experience_years", { ascending: false }).limit(1)
      .then(({ data }) => setSpotlight((data?.[0] as Profile) ?? null));
  }, [user, showNextBooking]);

  return (
    <aside className="hidden lg:block space-y-6">
      {showNextBooking && (
        <div className="bg-surface rounded-2xl border border-black/5 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Next booking</h3>
          {next ? (
            <Link href="/bookings" className="flex items-center gap-3">
              <Avatar name={next.sitter?.full_name ?? "Sitter"} url={next.sitter?.avatar_url} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{next.sitter?.full_name}</div>
                <div className="text-xs text-ink-soft mt-0.5">{formatDate(next.start_at)}</div>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_CONFIG[next.status as BookingStatus]?.color ?? ""}`}>{STATUS_CONFIG[next.status as BookingStatus]?.label ?? next.status}</span>
            </Link>
          ) : (
            <div className="text-center py-1">
              <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center mx-auto mb-2"><CalendarDays className="w-5 h-5 text-brand" /></div>
              <p className="text-xs text-ink-soft mb-2">No upcoming bookings</p>
              <Link href="/browse" className="text-xs font-medium text-brand inline-flex items-center gap-1 hover:gap-1.5 transition-all">Find a sitter <ArrowRight className="w-3 h-3" /></Link>
            </div>
          )}
        </div>
      )}

      {spotlight && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-brand" />Sitter spotlight</h3>
          <SitterMini sitter={spotlight} />
        </div>
      )}

      <div className="space-y-2.5">
        <h3 className="text-sm font-semibold text-ink">Pet-care tip</h3>
        <TipWidget />
      </div>
    </aside>
  );
}
