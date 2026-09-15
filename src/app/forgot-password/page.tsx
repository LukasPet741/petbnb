import type { Metadata } from "next";
import ForgotPasswordClient from "./ForgotPasswordClient";
import en from "@/lib/i18n/en";

// Not indexable, for the same reason as the login page.
export const metadata: Metadata = {
  title: en.auth.forgot.title,
  description: en.auth.forgot.subtitle,
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
