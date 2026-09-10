import type { Metadata } from "next";
import LoginClient from "./LoginClient";
import en from "@/lib/i18n/en";

/**
 * Crawlable but not indexable. robots.txt does not disallow this route — it is linked
 * from every public page, and a disallow would turn those links into crawl errors
 * rather than a quiet skip. `index: false` is the narrower instrument: follow the
 * links out, keep the page itself out of results.
 */
export const metadata: Metadata = {
  title: en.auth.login.title,
  description: en.auth.login.subtitle,
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <LoginClient />;
}
