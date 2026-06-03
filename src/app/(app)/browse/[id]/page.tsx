"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Clock, CheckCircle, Shield, Star, ArrowLeft, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SERVICE_LABELS, type ServiceType, type Profile } from "@/lib/mock-data";
import Avatar from "@/components/Avatar";
import StarRating from "@/components/StarRating";
import Badge from "@/components/Badge";

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

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-[#D95F3B] border-t-transparent rounded-full animate-spin" /></div>;
  if (!sitter) return <div className="max-w-4xl mx-auto px-4 py-16 text-center"><p className="text-stone-500">Sitter not found.</p><Link href="/browse" className="text-[#D95F3B] hover:underline mt-2 inline-block">Back to browse</Link></div>;

  const activeServices = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][]).filter(([, v]) => v).map(([k]) => ({ key: k, label: SERVICE_LABELS[k] }));

  const MOCK_REVIEWS = [
    { name: "Rachel T.", rating: 5, text: "Absolutely brilliant! My dog came back so happy.", date: "May 2026" },
    { name: "David M.", rating: 5, text: "Professional, caring and great communication throughout.", date: "Apr 2026" },
    { name: "Sophie L.", rating: 4, text: "Really happy with the service, will definitely book again.", date: "Mar 2026" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/browse" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to browse
      </Link>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-6">
            <div className="flex items-start gap-5">
              <Avatar name={sitter.full_name ?? "Sitter"} url={sitter.avatar_url} size="xl" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-stone-900">{sitter.full_name}</h1>
                  <CheckCircle className="w-5 h-5 text-[#D95F3B]" />
                </div>
                {sitter.rating !== undefined && <StarRating rating={sitter.rating} count={sitter.review_count} />}
                <div className="flex items-center gap-4 mt-2 text-sm text-stone-500">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{sitter.city}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{sitter.experience_years} yrs exp.</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">{activeServices.map(({ key, label }) => <Badge key={key} variant="coral">{label}</Badge>)}</div>
              </div>
            </div>
            {sitter.about_me && (
              <div className="mt-5 pt-5 border-t border-stone-100">
                <h2 className="font-semibold text-stone-900 mb-2">About me</h2>
                <p className="text-stone-600 text-sm leading-relaxed">{sitter.about_me}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Verified credentials</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Shield, label: "ID Verified", desc: "Government-issued ID confirmed" },
                { icon: CheckCircle, label: "Background check", desc: "Enhanced DBS checked" },
                { icon: Star, label: "Top rated", desc: `${sitter.experience_years}+ years of pet care` },
                { icon: Clock, label: "Experienced", desc: `${sitter.experience_years} years experience` },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4 text-green-600" /></div>
                  <div><div className="text-sm font-medium text-stone-900">{label}</div><div className="text-xs text-stone-500 mt-0.5">{desc}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Recent reviews</h2>
            <div className="space-y-4">
              {MOCK_REVIEWS.map((review) => (
                <div key={review.name} className="pb-4 border-b border-stone-100 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={review.name} size="sm" />
                      <span className="text-sm font-medium text-stone-900">{review.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex">{Array.from({ length: review.rating }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}</div>
                      <span className="text-xs text-stone-400">{review.date}</span>
                    </div>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 sticky top-24">
            <div className="text-center pb-4 border-b border-stone-100">
              <div className="text-3xl font-bold text-stone-900">£{sitter.rate_per_hour}</div>
              <div className="text-sm text-stone-500 mt-0.5">per hour</div>
            </div>
            <div className="py-4 space-y-3 border-b border-stone-100">
              {activeServices.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">{label}</span>
                  <span className="font-medium text-stone-900">£{sitter.rate_per_hour}/hr</span>
                </div>
              ))}
            </div>
            <div className="pt-4 space-y-3">
              <Link href={`/bookings/new?sitter=${sitter.id}`} className="flex items-center justify-center gap-2 w-full h-11 bg-[#D95F3B] text-white rounded-xl font-medium text-sm hover:bg-[#c4482a] transition-colors">
                <Calendar className="w-4 h-4" />Book {sitter.full_name?.split(" ")[0]}
              </Link>
              <p className="text-xs text-stone-400 text-center">Free cancellation up to 24 hours before</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
