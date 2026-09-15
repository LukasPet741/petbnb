"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Link2Off, ShieldCheck } from "lucide-react";
import { updatePassword, matchAuthErrorKey } from "@/lib/auth";
import { fadeUp } from "@/lib/motion";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import PasswordShell, { FormError, Spinner, inputClass, primaryButtonClass } from "@/components/PasswordShell";

/**
 * Where a reset email's link lands. Supabase reads the link's tokens while the session loads, so
 * by the time `loading` is false a valid link has signed the person in for recovery. No session
 * then means the link was expired, already used, or opened in a different browser.
 */
export default function ResetPasswordClient() {
  const { t } = useLanguage();
  const { user, loading: sessionLoading } = useAuth();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError(t("auth.signup.passwordMismatch")); return; }
    setError("");
    setSaving(true);
    try {
      await updatePassword(form.password);
      setDone(true);
    } catch (err: unknown) {
      const key = err instanceof Error ? matchAuthErrorKey(err.message) : null;
      if (key === "auth.knownErrors.linkExpired") setExpired(true);
      else setError(key ? t(key) : t("auth.reset.errorFallback"));
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading) {
    return (
      <PasswordShell>
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </PasswordShell>
    );
  }

  if (done) {
    return (
      <PasswordShell>
        <motion.div variants={fadeUp} className="w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mb-5">
          <ShieldCheck className="w-6 h-6" aria-hidden />
        </motion.div>
        <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-2 tracking-tight">{t("auth.reset.doneTitle")}</motion.h1>
        <motion.p variants={fadeUp} className="text-ink-soft mb-6">{t("auth.reset.doneBody")}</motion.p>
        <motion.div variants={fadeUp}>
          <Link href="/dashboard" className={primaryButtonClass}>
            {t("auth.reset.continue")} <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </motion.div>
      </PasswordShell>
    );
  }

  if (!user || expired) {
    return (
      <PasswordShell>
        <motion.div variants={fadeUp} className="w-12 h-12 rounded-2xl bg-amber-soft text-amber-strong flex items-center justify-center mb-5">
          <Link2Off className="w-6 h-6" aria-hidden />
        </motion.div>
        <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-2 tracking-tight">{t("auth.reset.expiredTitle")}</motion.h1>
        <motion.p variants={fadeUp} className="text-ink-soft mb-6">{t("auth.reset.expiredBody")}</motion.p>
        <motion.div variants={fadeUp}>
          <Link href="/forgot-password" className={primaryButtonClass}>{t("auth.reset.requestNew")}</Link>
        </motion.div>
        <motion.p variants={fadeUp} className="text-center text-sm text-ink-soft mt-6">
          <Link href="/login" className="text-brand font-medium hover:underline">{t("auth.forgot.backToLogin")}</Link>
        </motion.p>
      </PasswordShell>
    );
  }

  return (
    <PasswordShell>
      <motion.h1 variants={fadeUp} className="font-display text-3xl font-semibold text-ink mb-1 tracking-tight">{t("auth.reset.title")}</motion.h1>
      <motion.p variants={fadeUp} className="text-ink-soft mb-8">{t("auth.reset.subtitle")}</motion.p>

      {error && <FormError message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <motion.div variants={fadeUp}>
          <label htmlFor="reset-password" className="block text-sm font-medium text-ink mb-1.5">{t("auth.reset.passwordLabel")}</label>
          <div className="relative">
            <input id="reset-password" type={showPass ? "text" : "password"} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t("auth.reset.passwordPlaceholder")}
              required minLength={8} autoComplete="new-password" autoFocus className={`${inputClass} pr-11`} />
            <button type="button" onClick={() => setShowPass(!showPass)} aria-pressed={showPass}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-ink-soft/60 hover:text-ink active:text-ink">
              {showPass ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
            </button>
          </div>
        </motion.div>
        <motion.div variants={fadeUp}>
          <label htmlFor="reset-confirm" className="block text-sm font-medium text-ink mb-1.5">{t("auth.reset.confirmLabel")}</label>
          <input id="reset-confirm" type="password" value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder={t("auth.reset.confirmPlaceholder")}
            required autoComplete="new-password" className={inputClass} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <motion.button type="submit" disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`${primaryButtonClass} mt-2`}>
            {saving ? <Spinner /> : <>{t("auth.reset.submit")} <ArrowRight className="w-4 h-4" aria-hidden /></>}
          </motion.button>
        </motion.div>
      </form>
    </PasswordShell>
  );
}
