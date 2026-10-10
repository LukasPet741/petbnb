"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signIn, matchAuthErrorKey } from "@/lib/auth";
import { fadeUp } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import { useRedirectIfSignedIn } from "@/hooks/useRedirectIfSignedIn";
import { useNextPath } from "@/hooks/useNextPath";
import { nextFromSearch, withNext } from "@/lib/next-path";
import AuthShell, { FormError, PasswordToggle, Spinner, inputClass, primaryButtonClass } from "@/components/AuthShell";

export default function LoginClient() {
  const { t } = useLanguage();
  useRedirectIfSignedIn();
  const next = useNextPath();
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
      router.push(nextFromSearch(window.location.search) ?? "/dashboard");
    } catch (err: unknown) {
      const key = err instanceof Error ? matchAuthErrorKey(err.message) : null;
      setError(key ? t(key) : t("auth.login.errorFallback"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-1 tracking-tight">{t("auth.login.title")}</motion.h1>
      <motion.p variants={fadeUp} className="text-ink-soft mb-8">{t("auth.login.subtitle")}</motion.p>

      {error && <FormError message={error} />}

      <form onSubmit={handleSubmit} className="space-y-5">
        <motion.div variants={fadeUp}>
          <label htmlFor="login-email" className="block text-sm font-medium text-ink mb-1.5">{t("auth.login.form.emailLabel")}</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.login.form.emailPlaceholder")} required autoComplete="email"
            className={inputClass} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-ink">{t("auth.login.form.passwordLabel")}</label>
            <Link href="/forgot-password" className="text-sm text-brand font-medium hover:underline">{t("auth.login.forgotPassword")}</Link>
          </div>
          <div className="relative">
            <input id="login-password" type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.login.form.passwordPlaceholder")} required autoComplete="current-password"
              className={`${inputClass} pr-11`} />
            <PasswordToggle shown={showPass} onToggle={() => setShowPass(!showPass)} />
          </div>
        </motion.div>
        <motion.div variants={fadeUp}>
          <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={primaryButtonClass}>
            {loading ? <Spinner /> : <>{t("common.signIn")} <ArrowRight className="w-4 h-4" /></>}
          </motion.button>
        </motion.div>
      </form>

      <motion.p variants={fadeUp} className="text-center text-sm text-ink-soft mt-6">
        {t("auth.login.noAccount")}{" "}
        <Link href={withNext("/signup", next)} className="text-brand font-medium hover:underline">{t("auth.login.createOneFree")}</Link>
      </motion.p>
      <motion.p variants={fadeUp} className="text-center text-xs text-ink-soft/70 mt-4">
        {t("auth.login.termsAgreementPrefix")} <Link href="/legal/terms" className="underline">{t("common.terms")}</Link>.
      </motion.p>
    </AuthShell>
  );
}
