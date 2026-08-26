"use client";
import Link from "next/link";
import { PawPrint, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signIn } from "@/lib/auth";
import { AUTH } from "@/lib/images";
import { fadeUp, stagger, slideRight } from "@/lib/motion";

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Left — photography */}
      <motion.div
        className="hidden lg:block lg:w-1/2 relative overflow-hidden"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      >
        <img src={AUTH.login} alt="A dog being cared for" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
        <div className="absolute inset-0 p-12 flex flex-col justify-between">
          <Link href="/" className="flex items-center gap-2.5 w-fit">
            <span className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-white" />
            </span>
            <span className="text-white font-display font-semibold text-xl tracking-tight">PetBnB</span>
          </Link>
          <div>
            <h2 className="text-white font-display text-3xl font-semibold leading-tight mb-2 max-w-sm">Your pet is in good hands.</h2>
            <p className="text-white/70 max-w-sm leading-relaxed">Sign in to manage your pets, bookings and sitter profile.</p>
          </div>
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

          <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-1 tracking-tight">Welcome back</motion.h1>
          <motion.p variants={fadeUp} className="text-ink-soft mb-8">Sign in to your account to continue.</motion.p>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div variants={fadeUp}>
              <label className="block text-sm font-medium text-ink mb-1.5">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition" />
            </motion.div>
            <motion.div variants={fadeUp}>
              <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required
                  className="w-full h-11 px-3.5 pr-11 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft/60 hover:text-ink">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
            <motion.div variants={fadeUp}>
              <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full h-11 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>Sign in <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.div>
          </form>

          <motion.p variants={fadeUp} className="text-center text-sm text-ink-soft mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-brand font-medium hover:underline">Create one free</Link>
          </motion.p>
          <motion.p variants={fadeUp} className="text-center text-xs text-ink-soft/70 mt-4">
            By signing in you agree to our <Link href="/terms" className="underline">Terms &amp; Conditions</Link>.
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
