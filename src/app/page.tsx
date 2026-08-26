"use client";
import Link from "next/link";
import { PawPrint, Search, ArrowRight, Check, MapPin, ChevronDown, Dog, Home, Sun, Scissors, Heart, CalendarCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { HERO, SECTION } from "@/lib/images";
import { SERVICE_LABELS, type ServiceType, type Profile } from "@/lib/types";
import Avatar from "@/components/Avatar";

const SERVICES = [
  { icon: Dog, label: "Dog Walking", desc: "Daily walks with a trusted local walker." },
  { icon: Home, label: "Boarding", desc: "Your pet stays overnight in a sitter's home." },
  { icon: Sun, label: "Daycare", desc: "Drop-off care while you're at work." },
  { icon: Scissors, label: "Grooming", desc: "Wash, trim and a little pampering." },
];

const HOW = [
  { step: "01", title: "Find a sitter", desc: "Browse local sitters and filter by city, service and rate." },
  { step: "02", title: "Send a request", desc: "Pick a date, choose your pet, and send a booking request in under a minute." },
  { step: "03", title: "They confirm", desc: "Your sitter accepts the request and takes it from there." },
];

const CITIES = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys"];

const FAQS = [
  { q: "How does PetBnB work?", a: "Browse local sitters, open a profile, and send a booking request for the dates and service you need. The sitter reviews it and confirms — then you're set." },
  { q: "How much does it cost?", a: "Each sitter sets their own hourly rate (they start from around €10/hr). PetBnB doesn't add any booking fees on top." },
  { q: "Which areas are covered?", a: "Sitters are active across Vilnius, Kaunas, Klaipėda, Šiauliai and Panevėžys, with more cities as the community grows." },
  { q: "How do I become a sitter?", a: "Create an account, open your Profile, switch on Sitter mode, and add your services, rate and a short bio. You'll appear in browse results right away." },
  { q: "Is this a real company?", a: "PetBnB is a university project — a full-stack demo marketplace built to show how the experience could work end to end." },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

function PublicSitterCard({ sitter }: { sitter: Profile }) {
  const services = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][])
    .filter(([, v]) => v).map(([k]) => SERVICE_LABELS[k]).slice(0, 3);
  return (
    <Link href="/signup" className="group block bg-surface rounded-2xl border border-black/5 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3.5">
        <Avatar name={sitter.full_name} url={sitter.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink truncate">{sitter.full_name}</div>
          <div className="flex items-center gap-1 text-xs text-ink-soft mt-0.5"><MapPin className="w-3.5 h-3.5" />{sitter.city}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-ink">€{sitter.rate_per_hour}</div>
          <div className="text-[11px] text-ink-soft">/ hour</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-4">
        {services.map((s) => <span key={s} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-soft text-brand-strong">{s}</span>)}
      </div>
    </Link>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [sitters, setSitters] = useState<Profile[]>([]);
  const [loadingSitters, setLoadingSitters] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("is_sitter", true)
      .order("experience_years", { ascending: false }).limit(6)
      .then(({ data }) => { setSitters((data as Profile[]) ?? []); setLoadingSitters(false); });
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 bg-canvas/80 backdrop-blur-md border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg text-ink">
            <span className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </span>
            <span className="font-display tracking-tight">PetBnB</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="text-sm font-medium text-ink-soft hover:text-ink transition-colors px-3 py-2">Sign in</Link>
            <Link href="/signup" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-strong transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 lg:pt-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-brand-soft text-brand-strong px-3.5 py-1.5 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-brand rounded-full" />
              Pet care across Lithuania
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display text-5xl md:text-6xl font-semibold text-ink leading-[1.05] tracking-tight mb-6">
              Loving care for<br />your pet, nearby.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-ink-soft leading-relaxed mb-8 max-w-md">
              Find a trusted local sitter for walking, boarding, daycare and grooming. Book in minutes.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 max-w-md">
              <div className="flex-1 relative">
                <MapPin className="w-4 h-4 text-ink-soft/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Your city" className="w-full h-12 pl-10 pr-4 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand text-sm shadow-sm" />
              </div>
              <Link href="/signup" className="h-12 px-6 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors flex items-center gap-2 justify-center shadow-sm whitespace-nowrap">
                Find sitters <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.p variants={fadeUp} className="text-sm text-ink-soft/80 mt-5">Free to join · No booking fees</motion.p>
          </motion.div>

          {/* Photo collage */}
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: "easeOut" }} className="relative hidden lg:block h-[480px]">
            <div className="absolute right-0 top-0 w-72 h-[420px] rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5">
              <img src={HERO.main} alt="Happy dog" className="w-full h-full object-cover" />
            </div>
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-0 top-12 w-44 h-44 rounded-2xl overflow-hidden shadow-lg ring-4 ring-canvas">
              <img src={HERO.topRight} alt="Kitten" className="w-full h-full object-cover" />
            </motion.div>
            <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute left-6 bottom-0 w-56 h-40 rounded-2xl overflow-hidden shadow-lg ring-4 ring-canvas">
              <img src={HERO.bottomLeft} alt="Walking dogs" className="w-full h-full object-cover" />
            </motion.div>
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-2 top-1 bg-surface rounded-2xl shadow-lg ring-1 ring-black/5 p-3.5 flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center"><Heart className="w-5 h-5 text-white fill-white" /></div>
              <div>
                <div className="text-xs font-semibold text-ink">Trusted sitters</div>
                <div className="text-[11px] text-ink-soft">in your city</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Cities strip ── */}
      <section className="border-y border-black/5 bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-sm text-ink-soft">Available in</span>
          {CITIES.map((c) => (
            <span key={c} className="flex items-center gap-1.5 text-sm font-medium text-ink"><MapPin className="w-3.5 h-3.5 text-brand" />{c}</span>
          ))}
        </div>
      </section>

      {/* ── Services ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="max-w-xl mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">Everything your pet needs</h2>
            <p className="text-ink-soft">From daily walks to overnight stays. Sitters set their own rates, starting from around €10/hr.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map(({ icon: Icon, label, desc }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -6 }} className="bg-surface rounded-2xl border border-black/5 shadow-sm p-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-soft flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-brand" />
                </div>
                <h3 className="font-semibold text-ink mb-1.5">{label}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Meet sitters (real data) ── */}
      <section className="py-20 bg-surface border-y border-black/5">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="flex items-end justify-between mb-10 gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">Meet some sitters</h2>
              <p className="text-ink-soft max-w-md">Real people who love animals, ready to care for yours.</p>
            </div>
            <Link href="/signup" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-brand hover:gap-2.5 transition-all whitespace-nowrap">
              See all <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {loadingSitters
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-canvas rounded-2xl border border-black/5 p-5 h-[148px] animate-pulse" />
                ))
              : sitters.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}>
                    <PublicSitterCard sitter={s} />
                  </motion.div>
                ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">How it works</h2>
            <p className="text-ink-soft">Three simple steps to peace of mind.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW.map(({ step, title, desc }, i) => (
              <motion.div key={step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}
                className="text-center flex flex-col items-center">
                <div className="w-14 h-14 bg-brand-soft text-brand-strong rounded-2xl flex items-center justify-center font-display font-semibold text-lg mb-5">{step}</div>
                <h3 className="font-semibold text-ink text-lg mb-2">{title}</h3>
                <p className="text-ink-soft text-sm leading-relaxed max-w-xs">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Become a sitter ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-ink rounded-3xl overflow-hidden grid lg:grid-cols-2">
            <div className="p-10 lg:p-14 flex flex-col justify-center">
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">Love animals?<br />Earn doing it.</h2>
              <p className="text-white/60 mb-8 leading-relaxed">List yourself as a sitter, set your own rate and hours, and start accepting bookings from owners nearby.</p>
              <ul className="grid grid-cols-2 gap-3 mb-9">
                {["Set your own rate", "Choose your services", "Work your own hours", "Free to list"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-white/80 text-sm">
                    <span className="w-5 h-5 rounded-full bg-brand/30 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-white" /></span>{item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand-strong transition-colors w-fit">
                Become a sitter <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="relative min-h-[280px] lg:min-h-0">
              <img src={SECTION.becomeSitter} alt="A happy dog with its sitter" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-surface border-t border-black/5">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-10 text-center tracking-tight">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map(({ q, a }, i) => (
              <div key={i} className="border border-black/5 rounded-xl overflow-hidden bg-canvas">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-brand-softer transition-colors">
                  <span className="font-medium text-ink text-sm pr-4">{q}</span>
                  <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.25 }}>
                    <ChevronDown className="w-4 h-4 text-ink-soft flex-shrink-0" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
                      <div className="px-5 pb-4 text-sm text-ink-soft leading-relaxed">{a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mx-auto mb-5">
              <CalendarCheck className="w-7 h-7 text-brand" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">Ready to find your sitter?</h2>
            <p className="text-ink-soft mb-8">Create a free account and book your first sitter today.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="px-8 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand-strong transition-colors flex items-center justify-center gap-2">
                Create free account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="px-8 py-3 bg-surface border border-black/10 text-ink rounded-xl font-medium hover:bg-brand-softer transition-colors">
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-ink text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-2 font-display font-semibold text-lg">
              <span className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center"><PawPrint className="w-5 h-5 text-white" /></span>
              PetBnB
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Create account</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-sm text-white/45 text-center md:text-left">
            © {new Date().getFullYear()} PetBnB. A student project connecting pet owners with local sitters.
          </div>
        </div>
      </footer>
    </div>
  );
}
