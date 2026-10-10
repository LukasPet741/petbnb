"use client";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signUp, matchAuthErrorKey } from "@/lib/auth";
import { AUTH } from "@/lib/images";
import { fadeUp, stagger } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import { useRedirectIfSignedIn } from "@/hooks/useRedirectIfSignedIn";
import { useNextPath } from "@/hooks/useNextPath";
import { nextFromSearch, withNext } from "@/lib/next-path";
import AuthShell, { FormError, PasswordToggle, Spinner, inputClass, primaryButtonClass } from "@/components/AuthShell";

const PERK_KEYS = ["browse", "book", "manage", "track"] as const;

export default function SignupClient() {
  const { t } = useLanguage();
  useRedirectIfSignedIn();
  const next = useNextPath();
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
      // A new account must finish its profile before the app lets it anywhere; ?next= rides
      // along so /profile can continue to the page the visitor came for.
      router.push(withNext("/profile", nextFromSearch(window.location.search)));
    } catch (err: unknown) {
      const key = err instanceof Error ? matchAuthErrorKey(err.message) : null;
      setError(key ? t(key) : t("auth.signup.errorFallback"));
    } finally { setLoading(false); }
  };

  const hero = (
    <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="space-y-7">
      <motion.div variants={fadeUp}>
        <h2 className="font-display text-3xl font-semibold text-white leading-tight mb-3">{t("auth.signup.heroTitle")}</h2>
        <p className="text-white/80 leading-relaxed max-w-sm">{t("auth.signup.heroSubtitle")}</p>
      </motion.div>
      <motion.ul variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-3">
        {PERK_KEYS.map((key) => (
          <motion.li key={key} variants={fadeUp} className="flex items-center gap-3 text-white/90 text-sm">
            <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-white" />
            </span>
            {t(`auth.signup.perks.${key}`)}
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  );

  const fields = [
    { key: "email", type: "email", autoComplete: "email" },
    { key: "password", type: showPass ? "text" : "password", autoComplete: "new-password" },
    { key: "confirm", type: "password", autoComplete: "new-password" },
  ] as const;

  return (
    <AuthShell image={AUTH.signup} imageAlt={t("auth.signup.imageAlt")} hero={hero}>
      <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-1 tracking-tight">{t("auth.signup.title")}</motion.h1>
      <motion.p variants={fadeUp} className="text-ink-soft mb-8">{t("auth.signup.subtitle")}</motion.p>

      {error && <FormError message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map(({ key, type, autoComplete }) => (
          <motion.div key={key} variants={fadeUp}>
            <label htmlFor={`signup-${key}`} className="block text-sm font-medium text-ink mb-1.5">{t(`auth.signup.form.${key}Label`)}</label>
            <div className="relative">
              <input id={`signup-${key}`} type={type} value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={t(`auth.signup.form.${key}Placeholder`)} required minLength={key === "password" ? 8 : undefined}
                autoComplete={autoComplete} className={`${inputClass} pr-11`} />
              {key === "password" && <PasswordToggle shown={showPass} onToggle={() => setShowPass(!showPass)} />}
            </div>
          </motion.div>
        ))}
        <motion.div variants={fadeUp}>
          <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`${primaryButtonClass} mt-2`}>
            {loading ? <Spinner /> : <>{t("common.createAccount")} <ArrowRight className="w-4 h-4" /></>}
          </motion.button>
        </motion.div>
      </form>

      <motion.p variants={fadeUp} className="text-center text-sm text-ink-soft mt-6">
        {t("auth.signup.alreadyHaveAccount")}{" "}
        <Link href={withNext("/login", next)} className="text-brand font-medium hover:underline">{t("common.signIn")}</Link>
      </motion.p>
      <motion.p variants={fadeUp} className="text-center text-xs text-ink-soft/70 mt-4">
        {t("auth.signup.termsAgreementPrefix")} <Link href="/legal/terms" className="underline">{t("common.terms")}</Link>.
      </motion.p>
    </AuthShell>
  );
}
