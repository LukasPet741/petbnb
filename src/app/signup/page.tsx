"use client";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signUp, matchAuthErrorKey } from "@/lib/auth";
import { AUTH } from "@/lib/images";
import { fadeUp, stagger, slideRight } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Logo from "@/components/Logo";

export default function SignupPage() {
  const { t } = useLanguage();
  const PERKS = [
    t("auth.signup.perks.browse"),
    t("auth.signup.perks.book"),
    t("auth.signup.perks.manage"),
    t("auth.signup.perks.track"),
  ];
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError(t("auth.signup.passwordMismatch")); return; }
    setError(""); setLoading(true);
    try {
      await signUp(form.email, form.password);
      router.push("/profile");
    } catch (err: unknown) {
      const key = err instanceof Error ? matchAuthErrorKey(err.message) : null;
      setError(key ? t(key) : t("auth.signup.errorFallback"));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] bg-canvas flex">
      <LanguageSwitcher className="fixed top-4 right-4 z-10 bg-surface/90 backdrop-blur-sm shadow-[var(--shadow-sm)]" />
      {/* Left - brand + photo */}
      <motion.div
        className="hidden lg:block lg:w-1/2 relative overflow-hidden"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      >
        <img src={AUTH.signup} alt={t("auth.signup.imageAlt")} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-strong/90 via-brand/75 to-ink/80" />
        <div className="absolute inset-0 p-12 flex flex-col justify-between">
          <Link href="/" className="w-fit">
            <Logo size={40} showWordmark wordmarkClassName="text-white" />
          </Link>
          <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="space-y-7">
            <motion.div variants={fadeUp}>
              <h2 className="font-display text-3xl font-semibold text-white leading-tight mb-3">{t("auth.signup.heroTitle")}</h2>
              <p className="text-white/80 leading-relaxed max-w-sm">{t("auth.signup.heroSubtitle")}</p>
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

      {/* Right - form */}
      <motion.div className="flex-1 flex items-center justify-center p-6" variants={slideRight} initial="hidden" animate="show">
        <motion.div className="w-full max-w-md" variants={stagger(0.09)} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="lg:hidden mb-8">
            <Logo size={36} showWordmark />
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-1 tracking-tight">{t("auth.signup.title")}</motion.h1>
          <motion.p variants={fadeUp} className="text-ink-soft mb-8">{t("auth.signup.subtitle")}</motion.p>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: t("auth.signup.form.emailLabel"), type: "email", key: "email", placeholder: t("auth.signup.form.emailPlaceholder") },
              { label: t("auth.signup.form.passwordLabel"), type: showPass ? "text" : "password", key: "password", placeholder: t("auth.signup.form.passwordPlaceholder") },
              { label: t("auth.signup.form.confirmLabel"), type: "password", key: "confirm", placeholder: t("auth.signup.form.confirmPlaceholder") },
            ].map(({ label, type, key, placeholder }) => (
              <motion.div key={key} variants={fadeUp}>
                <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
                <div className="relative">
                  <input type={type} value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder} required minLength={key === "password" ? 8 : undefined}
                    autoComplete={key === "email" ? "email" : "new-password"}
                    className="w-full h-11 px-3.5 pr-11 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition" />
                  {key === "password" && (
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-ink-soft/60 hover:text-ink active:text-ink">
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
                  : <>{t("common.createAccount")} <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </motion.div>
          </form>

          <motion.p variants={fadeUp} className="text-center text-sm text-ink-soft mt-6">
            {t("auth.signup.alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-brand font-medium hover:underline">{t("common.signIn")}</Link>
          </motion.p>
          <motion.p variants={fadeUp} className="text-center text-xs text-ink-soft/70 mt-4">
            {t("auth.signup.termsAgreementPrefix")} <Link href="/legal/terms" className="underline">{t("common.terms")}</Link>.
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
