"use client";
import Link from "next/link";
import { PawPrint, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signIn } from "@/lib/auth";
import { fadeUp, stagger, slideLeft, slideRight } from "@/lib/motion";

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
    <div className="min-h-screen bg-[#F8F6F3] flex">
      {/* Left panel */}
      <motion.div
        className="hidden lg:flex lg:w-1/2 bg-stone-900 relative overflow-hidden flex-col justify-between p-12"
        variants={slideLeft}
        initial="hidden"
        animate="show"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D95F3B] rounded-full opacity-10 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#D95F3B] rounded-full opacity-10 translate-y-1/3 -translate-x-1/3" />
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="w-10 h-10 bg-[#D95F3B] rounded-xl flex items-center justify-center">
            <PawPrint className="w-6 h-6 text-white" />
          </span>
          <span className="text-white font-bold text-xl">PetBnB</span>
        </div>
        <motion.div className="relative z-10 space-y-8" variants={stagger(0.12)} initial="hidden" animate="show">
          <motion.blockquote variants={fadeUp} className="text-white text-2xl font-medium leading-relaxed">
            &ldquo;Found the most wonderful sitter for our golden retriever. He came back exhausted and happy every single day.&rdquo;
          </motion.blockquote>
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-700 rounded-full flex items-center justify-center text-stone-300 font-semibold">M</div>
            <div>
              <div className="text-white font-medium text-sm">Maria K.</div>
              <div className="text-stone-400 text-xs">Pet owner, London</div>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="flex gap-3">
            {[{ stat: "10,000+", label: "Pet owners" }, { stat: "2,400+", label: "Sitters" }, { stat: "4.9★", label: "Avg. rating" }].map(({ stat, label }) => (
              <div key={label} className="bg-stone-800 rounded-xl p-4 flex-1 text-center">
                <div className="text-[#D95F3B] font-bold text-lg">{stat}</div>
                <div className="text-stone-400 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Right panel */}
      <motion.div
        className="flex-1 flex items-center justify-center p-6"
        variants={slideRight}
        initial="hidden"
        animate="show"
      >
        <motion.div className="w-full max-w-md" variants={stagger(0.09)} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="lg:hidden flex items-center gap-2 mb-8">
            <span className="w-9 h-9 bg-[#D95F3B] rounded-lg flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </span>
            <span className="font-bold text-xl text-stone-900">PetBnB</span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-2xl font-bold text-stone-900 mb-1">Welcome back</motion.h1>
          <motion.p variants={fadeUp} className="text-stone-500 mb-8">Sign in to your account to continue.</motion.p>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div variants={fadeUp}>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] focus:border-transparent text-sm transition" />
            </motion.div>
            <motion.div variants={fadeUp}>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required
                  className="w-full h-11 px-3.5 pr-11 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] focus:border-transparent text-sm transition" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
            <motion.div variants={fadeUp}>
              <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full h-11 bg-[#D95F3B] text-white rounded-xl font-medium text-sm hover:bg-[#c4482a] transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>Sign in <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.div>
          </form>

          <motion.p variants={fadeUp} className="text-center text-sm text-stone-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#D95F3B] font-medium hover:underline">Create one free</Link>
          </motion.p>
          <motion.p variants={fadeUp} className="text-center text-xs text-stone-400 mt-4">
            By signing in you agree to our <Link href="/terms" className="underline">Terms & Conditions</Link>.
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
