import type { Metadata } from "next";
import SignupClient from "./SignupClient";
import en from "@/lib/i18n/en";

// Not indexable, for the same reason as the login page.
export const metadata: Metadata = {
  title: en.auth.signup.title,
  description: en.auth.signup.subtitle,
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return <SignupClient />;
}
