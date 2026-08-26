"use client";
import Link from "next/link";
import { PawPrint, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signUp } from "@/lib/auth";
import { AUTH } from "@/lib/images";
import { fadeUp, stagger, slideRight } from "@/lib/motion";

const PERKS = [
  "Browse trusted local sitters",
  "Book walking, boarding, daycare & grooming",
  "Manage all your pets in one place",
  "Track every booking in one dashboard",
];

export default function SignupPage() {
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    setError(""); setLoading(true);
    try {
      await signUp(form.email, form.password);
      router.push("/profile");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Left — brand + photo */}
      <motion.div
        className="hidden lg:block lg:w-1/2 relative overflow-hidden"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      >
        <img src={AUTH.signup} alt="A cozy pet" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-strong/90 via-brand/75 to-ink/80" />
        <div className="absolute inset-0 p-12 flex flex-col justify-between">
          <Link href="/" className="flex items-center gap-2.5 w-fit">
            <span className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur">
              <PawPrint className="w-6 h-6 text-white" />
            </span>
            <span className="text-white font-display font-semibold text-xl tracking-tight">PetBnB</span>
          </Link>
          <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="space-y-7">
            <motion.div variants={fadeUp}>
              <h2 className="font-display text-3xl font-semibold text-white leading-tight mb-3">Care your pet deserves.</h2>
              <p className="text-white/80 leading-relaxed max-w-sm">Join PetBnB and find a reliable sitter in your neighbourhood — or start sitting yourself.</p>
            </motion.div>
            <motion.ul variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-3">
              {PERKS.map((perk) => (
                <motion.li key={perk} variants={fadeUp} className="flex items-center gap-3 text-white/90 text-sm">
                  <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                  {perk}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </motion.div>

      {/* Right — form */}
      <motion.div className="flex-1 flex items-center justify-center p-6" variants={slideRight} initial="hidden" animate="show">
        <motion.div className="w-full max-w-md" variants={stagger(0.09)} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="lg:hidden flex items-center gap-2 mb-8">
            <span className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </span>
            <span className="font-display font-semibold text-xl text-ink tracking-tight">PetBnB</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-1 tracking-tight">Create your account</motion.h1>
          <motion.p variants={fadeUp} className="text-ink-soft mb-8">Free to join. Takes less than a minute.</motion.p>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Email address", type: "email", key: "email", placeholder: "you@example.com" },
              { label: "Password", type: showPass ? "text" : "password", key: "password", placeholder: "At least 8 characters" },
              { label: "Confirm password", type: "password", key: "confirm", placeholder: "Repeat your password" },
            ].map(({ label, type, key, placeholder }) => (
              <motion.div key={key} variants={fadeUp}>
                <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
                <div className="relative">
                  <input type={type} value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder} required minLength={key === "password" ? 8 : undefined}
                    className="w-full h-11 px-3.5 pr-11 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition" />
                  {key === "password" && (
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft/60 hover:text-ink">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            <motion.div variants={fadeUp}>
              <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full h-11 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>Create account <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.div>
          </form>

          <motion.p variants={fadeUp} className="text-center text-sm text-ink-soft mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-brand font-medium hover:underline">Sign in</Link>
          </motion.p>
          <motion.p variants={fadeUp} className="text-center text-xs text-ink-soft/70 mt-4">
            By creating an account you agree to our <Link href="/terms" className="underline">Terms &amp; Conditions</Link>.
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
