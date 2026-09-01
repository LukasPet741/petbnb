"use client";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signIn, matchAuthErrorKey } from "@/lib/auth";
import { AUTH } from "@/lib/images";
import { fadeUp, stagger, slideRight } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const { t } = useLanguage();
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
      const key = err instanceof Error ? matchAuthErrorKey(err.message) : null;
      setError(key ? t(key) : t("auth.login.errorFallback"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-canvas flex">
      <LanguageSwitcher className="fixed top-4 right-4 z-10 bg-surface/90 backdrop-blur-sm shadow-[var(--shadow-sm)]" />
      {/* Left - photography */}
      <motion.div
        className="hidden lg:block lg:w-1/2 relative overflow-hidden"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      >
        <img src={AUTH.login} alt={t("auth.login.imageAlt")} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-strong/90 via-brand/75 to-ink/80" />
        <div className="absolute inset-0 p-12 flex flex-col justify-between">
          <Link href="/" className="w-fit">
            <Logo size={40} showWordmark wordmarkClassName="text-white" />
          </Link>
          <div>
            <h2 className="text-white font-display text-3xl font-semibold leading-tight mb-2 max-w-sm">{t("auth.login.heroTitle")}</h2>
            <p className="text-white/70 max-w-sm leading-relaxed">{t("auth.login.heroSubtitle")}</p>
          </div>
        </div>
      </motion.div>

      {/* Right - form */}
      <motion.div className="flex-1 flex items-center justify-center p-6" variants={slideRight} initial="hidden" animate="show">
        <motion.div className="w-full max-w-md" variants={stagger(0.09)} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="lg:hidden mb-8">
            <Logo size={36} showWordmark />
          </motion.div>

          <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-1 tracking-tight">{t("auth.login.title")}</motion.h1>
          <motion.p variants={fadeUp} className="text-ink-soft mb-8">{t("auth.login.subtitle")}</motion.p>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div variants={fadeUp}>
              <label className="block text-sm font-medium text-ink mb-1.5">{t("auth.login.form.emailLabel")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.login.form.emailPlaceholder")} required
                className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition" />
            </motion.div>
            <motion.div variants={fadeUp}>
              <label className="block text-sm font-medium text-ink mb-1.5">{t("auth.login.form.passwordLabel")}</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.login.form.passwordPlaceholder")} required
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
                  : <>{t("common.signIn")} <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.div>
          </form>

          <motion.p variants={fadeUp} className="text-center text-sm text-ink-soft mt-6">
            {t("auth.login.noAccount")}{" "}
            <Link href="/signup" className="text-brand font-medium hover:underline">{t("auth.login.createOneFree")}</Link>
          </motion.p>
          <motion.p variants={fadeUp} className="text-center text-xs text-ink-soft/70 mt-4">
            {t("auth.login.termsAgreementPrefix")} <Link href="/terms" className="underline">{t("common.terms")}</Link>.
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
