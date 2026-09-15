"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { AUTH } from "@/lib/images";
import { fadeUp, stagger, slideRight } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Logo from "@/components/Logo";

/**
 * The frame of /forgot-password and /reset-password: the login page's photo half and glass
 * card, so recovering an account looks like the sign-in it leads back to.
 */
export default function PasswordShell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-[100dvh] flex">
      <LanguageSwitcher className="fixed top-4 right-4 z-10 glass-panel border rounded-full" />
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

      <motion.div className="flex-1 flex items-center justify-center p-4 sm:p-6" variants={slideRight} initial="hidden" animate="show">
        <motion.div className="w-full max-w-md glass-card rounded-[var(--radius-card)] border p-5 sm:p-8" variants={stagger(0.09)} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="lg:hidden mb-8">
            <Link href="/" className="inline-block"><Logo size={36} showWordmark /></Link>
          </motion.div>
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

export const inputClass =
  "w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition";

export const primaryButtonClass =
  "w-full h-11 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors flex items-center justify-center gap-2 disabled:opacity-60";

export function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}

export function FormError({ message }: { message: string }) {
  return (
    <motion.div role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">
      {message}
    </motion.div>
  );
}
