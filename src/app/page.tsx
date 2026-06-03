"use client";
import Link from "next/link";
import { PawPrint, Search, Shield, Star, ArrowRight, Check, MapPin, Clock, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

const SERVICES = [
  { icon: "🦮", label: "Dog Walking", desc: "Daily walks with trusted local walkers", price: "From £12/hr" },
  { icon: "🏠", label: "Boarding", desc: "Your pet stays in a sitter's home", price: "From £25/night" },
  { icon: "☀️", label: "Daycare", desc: "Drop off while you're at work", price: "From £18/day" },
  { icon: "✂️", label: "Grooming", desc: "Wash, trim and pamper your pet", price: "From £30/session" },
];

const STATS = [
  { value: "12,000+", label: "Happy pet owners" },
  { value: "2,400+", label: "Verified sitters" },
  { value: "4.9 ★", label: "Average rating" },
  { value: "98%", label: "Would rebook" },
];

const HOW = [
  { step: "01", title: "Search your area", desc: "Browse verified sitters near you, filtered by service, price and availability." },
  { step: "02", title: "Book in seconds", desc: "Pick a date, choose your pet, and send a booking request — all in under a minute." },
  { step: "03", title: "Relax", desc: "Your sitter handles the rest. Get updates and photos while you're away." },
];

const REVIEWS = [
  { name: "Maria K.", city: "London", text: "Found the most wonderful sitter for our golden retriever. He came back exhausted and happy every single day.", rating: 5, pet: "Dog owner" },
  { name: "Tom B.", city: "Manchester", text: "PetBnB made our holiday stress-free. Our cats were in great hands and the sitter sent daily photos.", rating: 5, pet: "Cat owner" },
  { name: "Priya S.", city: "Birmingham", text: "The grooming service was excellent — my poodle has never looked so good. Will 100% be back.", rating: 5, pet: "Dog owner" },
];

const FAQS = [
  { q: "How are sitters verified?", a: "All sitters go through ID verification and are encouraged to complete an enhanced DBS check. You can see their credentials on their profile before booking." },
  { q: "What if something goes wrong?", a: "We have a dedicated support team available 7 days a week. All bookings are covered by our PetBnB guarantee." },
  { q: "Can I meet the sitter before booking?", a: "Absolutely. You can message any sitter directly through the platform and arrange a meet & greet before committing to a booking." },
  { q: "How do I become a sitter?", a: "Create an account, go to your profile, and toggle on 'Sitter mode'. Fill in your services, rate and bio — and you'll appear in search results straight away." },
];

// Reusable scroll-reveal wrapper
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F6F3] font-sans">

      {/* ── Nav ── */}
      <motion.header
        className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-stone-200"
        animate={{ boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,0.07)" : "none" }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2 font-bold text-lg text-stone-900"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="w-8 h-8 bg-[#D95F3B] rounded-lg flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </span>
            PetBnB
          </motion.div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-stone-600">
            {["Services", "How it works", "Reviews", "FAQ"].map((item, i) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                className="hover:text-stone-900 transition-colors"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.35 }}
              >
                {item}
              </motion.a>
            ))}
          </nav>
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Link href="/login" className="text-sm font-medium text-stone-700 hover:text-stone-900 transition-colors">Sign in</Link>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link href="/signup" className="px-4 py-2 bg-[#D95F3B] text-white rounded-lg text-sm font-medium hover:bg-[#c4482a] transition-colors">
                Get started
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative overflow-hidden">
        <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#D95F3B] rounded-full opacity-[0.07] translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-300 rounded-full opacity-[0.08] -translate-x-1/4 translate-y-1/4" />
        </motion.div>

        <div className="max-w-6xl mx-auto px-4 pt-20 pb-24 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 text-[#D95F3B] px-3.5 py-1.5 rounded-full text-sm font-medium mb-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="w-2 h-2 bg-[#D95F3B] rounded-full animate-pulse" />
              2,400+ verified sitters near you
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl font-bold text-stone-900 leading-tight tracking-tight mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Your pet deserves<br />
              <span className="text-[#D95F3B]">the best care.</span>
            </motion.h1>

            <motion.p
              className="text-xl text-stone-500 leading-relaxed mb-10 max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              Find trusted local sitters for walking, boarding, daycare and grooming. Book in minutes, cancel for free.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3 max-w-lg mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="flex-1 relative">
                <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Your city or postcode"
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] text-sm shadow-sm"
                />
              </div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/signup"
                  className="h-12 px-6 bg-[#D95F3B] text-white rounded-xl font-medium text-sm hover:bg-[#c4482a] transition-colors flex items-center gap-2 justify-center shadow-sm whitespace-nowrap"
                >
                  Find sitters <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>

            <motion.p
              className="text-sm text-stone-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              Free to join · No booking fees · Cancel anytime
            </motion.p>
          </div>

          {/* Floating review cards */}
          <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 flex-col gap-3 w-72">
            {[
              { delay: 0.4, ml: false, initial: 40, color: "bg-orange-100 text-[#D95F3B]", letter: "S", name: "Sarah C. — London", text: "Max loves his daily walks with Emma. She sends the cutest photos!" },
              { delay: 0.55, ml: true, initial: 50, color: "bg-blue-100 text-blue-600", letter: "J", name: "James O. — Bristol", text: "Used PetBnB for a 2-week holiday. Our dogs were so well looked after." },
            ].map(({ delay, ml, initial, color, letter, name, text }) => (
              <motion.div
                key={name}
                className={`bg-white rounded-2xl shadow-lg border border-stone-100 p-4${ml ? " ml-6" : ""}`}
                initial={{ opacity: 0, x: initial }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay }}
                whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-sm font-semibold`}>{letter}</div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">{name}</div>
                    <div className="flex">{"★★★★★".split("").map((s, i) => <span key={i} className="text-amber-400 text-xs">{s}</span>)}</div>
                  </div>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">&ldquo;{text}&rdquo;</p>
              </motion.div>
            ))}
            <motion.div
              className="bg-white rounded-2xl shadow-lg border border-stone-100 p-4"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              whileHover={{ y: -3 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#D95F3B] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-900">PetBnB Guarantee</div>
                  <div className="text-xs text-stone-500 mt-0.5">All bookings are protected</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-stone-900 py-12">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(({ value, label }, i) => (
            <Reveal key={label} delay={i * 0.1} className="text-center">
              <div className="text-3xl font-bold text-[#D95F3B]">{value}</div>
              <div className="text-sm text-stone-400 mt-1">{label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold text-stone-900 mb-3">Everything your pet needs</h2>
            <p className="text-stone-500 max-w-xl mx-auto">From daily walks to overnight stays, our sitters offer a full range of professional pet care services.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map(({ icon, label, desc, price }, i) => (
              <Reveal key={label} delay={i * 0.1}>
                <motion.div whileHover={{ y: -6, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <Link href="/signup" className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 block group">
                    <motion.div
                      className="text-3xl mb-4"
                      whileHover={{ scale: 1.2, rotate: 8 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      {icon}
                    </motion.div>
                    <h3 className="font-semibold text-stone-900 mb-1.5">{label}</h3>
                    <p className="text-sm text-stone-500 leading-relaxed mb-3">{desc}</p>
                    <div className="text-sm font-semibold text-[#D95F3B]">{price}</div>
                  </Link>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl font-bold text-stone-900 mb-3">How it works</h2>
            <p className="text-stone-500">Three simple steps to peace of mind.</p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW.map(({ step, title, desc }, i) => (
              <Reveal key={step} delay={i * 0.15} className="text-center flex flex-col items-center">
                <motion.div
                  className="w-16 h-16 bg-[#D95F3B] text-white rounded-2xl flex items-center justify-center font-bold text-lg mb-5 shadow-md"
                  whileHover={{ rotate: 6, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  {step}
                </motion.div>
                <h3 className="font-semibold text-stone-900 text-lg mb-2">{title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed max-w-xs">{desc}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="text-center mt-12">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 bg-[#D95F3B] text-white rounded-xl font-medium hover:bg-[#c4482a] transition-colors">
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="py-12 bg-orange-50 border-y border-orange-100">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: "Vetted sitters only", desc: "Every sitter is ID-verified and background-checked before appearing on PetBnB." },
            { icon: Star, title: "Genuine reviews", desc: "Every review is from a verified booking. No fake ratings, ever." },
            { icon: Clock, title: "24/7 support", desc: "Our team is on hand every day of the year if you or your pet need anything." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.1}>
              <motion.div className="flex items-start gap-4" whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 300 }}>
                <div className="w-10 h-10 bg-[#D95F3B] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-stone-900 text-sm">{title}</div>
                  <div className="text-stone-500 text-sm mt-1 leading-relaxed">{desc}</div>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Reviews ── */}
      <section id="reviews" className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold text-stone-900 mb-3">Loved by pet owners</h2>
            <p className="text-stone-500">Don&apos;t just take our word for it.</p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {REVIEWS.map(({ name, city, text, rating, pet }, i) => (
              <Reveal key={name} delay={i * 0.12}>
                <motion.div
                  className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 h-full"
                  whileHover={{ y: -5, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="flex mb-3">
                    {Array.from({ length: rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-stone-600 text-sm leading-relaxed mb-5">&ldquo;{text}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-stone-50">
                    <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-sm font-semibold text-[#D95F3B]">{name[0]}</div>
                    <div>
                      <div className="text-sm font-semibold text-stone-900">{name}</div>
                      <div className="text-xs text-stone-400">{pet} · {city}</div>
                    </div>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Become a sitter ── */}
      <section className="py-20 bg-stone-900 relative overflow-hidden">
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-[#D95F3B] rounded-full opacity-10"
          animate={{ scale: [1, 1.08, 1], x: [0, 12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{ translateX: "33%", translateY: "-33%" }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-64 h-64 bg-[#D95F3B] rounded-full opacity-10"
          animate={{ scale: [1, 1.1, 1], x: [0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          style={{ translateX: "-33%", translateY: "33%" }}
        />
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <Reveal>
            <h2 className="text-3xl font-bold text-white mb-4">Love animals? Earn doing it.</h2>
            <p className="text-stone-400 mb-8 text-lg leading-relaxed">
              Join 2,400+ sitters on PetBnB. Set your own hours, choose your services, and build a client base you love.
            </p>
            <ul className="flex flex-wrap justify-center gap-4 mb-10">
              {["Set your own rate", "Work your own hours", "Free to join", "Get paid weekly"].map((item) => (
                <motion.li key={item} className="flex items-center gap-2 text-stone-300 text-sm" whileHover={{ x: 3 }}>
                  <Check className="w-4 h-4 text-[#D95F3B]" />{item}
                </motion.li>
              ))}
            </ul>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 bg-[#D95F3B] text-white rounded-xl font-medium hover:bg-[#c4482a] transition-colors">
                Become a sitter <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-4">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold text-stone-900 mb-3">Frequently asked questions</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map(({ q, a }, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div className="border border-stone-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
                  >
                    <span className="font-medium text-stone-900 text-sm">{q}</span>
                    <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.25 }}>
                      <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 text-sm text-stone-500 leading-relaxed border-t border-stone-100 pt-3">
                          {a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 bg-[#F8F6F3]">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <Reveal>
            <motion.div
              className="text-4xl mb-4 inline-block"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              🐾
            </motion.div>
            <h2 className="text-3xl font-bold text-stone-900 mb-3">Ready to find your perfect sitter?</h2>
            <p className="text-stone-500 mb-8">Join thousands of pet owners who trust PetBnB every day.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link href="/signup" className="px-8 py-3 bg-[#D95F3B] text-white rounded-xl font-medium hover:bg-[#c4482a] transition-colors flex items-center justify-center gap-2">
                  Create free account <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link href="/login" className="px-8 py-3 bg-white border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors block">
                  Sign in
                </Link>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-stone-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 font-bold text-lg mb-3">
                <span className="w-8 h-8 bg-[#D95F3B] rounded-lg flex items-center justify-center"><PawPrint className="w-5 h-5 text-white" /></span>
                PetBnB
              </div>
              <p className="text-stone-400 text-sm leading-relaxed">Connecting pet owners with trusted local sitters.</p>
            </div>
            {[
              { title: "Services", links: [{ label: "Dog Walking", href: "/signup" }, { label: "Boarding", href: "/signup" }, { label: "Daycare", href: "/signup" }, { label: "Grooming", href: "/signup" }] },
              { title: "Company", links: [{ label: "How it works", href: "#how-it-works" }, { label: "Become a sitter", href: "/signup" }, { label: "Terms & Conditions", href: "/terms" }] },
              { title: "Account", links: [{ label: "Sign in", href: "/login" }, { label: "Create account", href: "/signup" }, { label: "My dashboard", href: "/dashboard" }] },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="font-semibold text-stone-300 mb-3 text-sm">{title}</h4>
                <ul className="space-y-2 text-sm text-stone-400">
                  {links.map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href} className="hover:text-white transition-colors">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-800 pt-6 text-sm text-stone-500 text-center">
            © {new Date().getFullYear()} PetBnB. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
