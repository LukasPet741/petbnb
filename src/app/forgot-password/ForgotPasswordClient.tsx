"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { requestPasswordReset, matchAuthErrorKey } from "@/lib/auth";
import { fadeUp } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import PasswordShell, { FormError, Spinner, inputClass, primaryButtonClass } from "@/components/PasswordShell";

export default function ForgotPasswordClient() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      // The same confirmation whether or not the address has an account, so the form cannot be
      // used to find out who is registered.
      setSent(true);
    } catch (err: unknown) {
      const key = err instanceof Error ? matchAuthErrorKey(err.message) : null;
      setError(key ? t(key) : t("auth.forgot.errorFallback"));
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = (
    <motion.p variants={fadeUp} className="text-center text-sm text-ink-soft mt-6">
      <Link href="/login" className="inline-flex items-center gap-1.5 text-brand font-medium hover:underline">
        <ArrowLeft className="w-4 h-4" aria-hidden />{t("auth.forgot.backToLogin")}
      </Link>
    </motion.p>
  );

  if (sent) {
    return (
      <PasswordShell>
        <motion.div variants={fadeUp} className="w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mb-5">
          <MailCheck className="w-6 h-6" aria-hidden />
        </motion.div>
        <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-2 tracking-tight">{t("auth.forgot.sentTitle")}</motion.h1>
        <motion.p variants={fadeUp} className="text-ink-soft mb-3">{t("auth.forgot.sentBody", { email })}</motion.p>
        <motion.p variants={fadeUp} className="text-sm text-ink-soft/80 mb-6">{t("auth.forgot.sentHint")}</motion.p>
        <motion.div variants={fadeUp}>
          <button type="button" onClick={() => setSent(false)}
            className="w-full h-11 rounded-xl border border-black/10 bg-surface text-ink font-medium text-sm hover:bg-black/[0.03] transition-colors">
            {t("auth.forgot.tryAgain")}
          </button>
        </motion.div>
        {backToLogin}
      </PasswordShell>
    );
  }

  return (
    <PasswordShell>
      <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-1 tracking-tight">{t("auth.forgot.title")}</motion.h1>
      <motion.p variants={fadeUp} className="text-ink-soft mb-8">{t("auth.forgot.subtitle")}</motion.p>

      {error && <FormError message={error} />}

      <form onSubmit={handleSubmit} className="space-y-5">
        <motion.div variants={fadeUp}>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-ink mb-1.5">{t("auth.forgot.emailLabel")}</label>
          <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.forgot.emailPlaceholder")}
            required autoComplete="email" autoFocus className={inputClass} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={primaryButtonClass}>
            {loading ? <Spinner /> : <>{t("auth.forgot.submit")} <ArrowRight className="w-4 h-4" aria-hidden /></>}
          </motion.button>
        </motion.div>
      </form>

      {backToLogin}
    </PasswordShell>
  );
}
