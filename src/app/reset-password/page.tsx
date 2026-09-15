import type { Metadata } from "next";
import ResetPasswordClient from "./ResetPasswordClient";
import en from "@/lib/i18n/en";

// Reached only from a reset email; never a search result.
export const metadata: Metadata = {
  title: en.auth.reset.title,
  description: en.auth.reset.subtitle,
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
