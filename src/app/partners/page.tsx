import type { Metadata } from "next";
import PartnersDirectory from "@/components/partners/PartnersDirectory";
import en from "@/lib/i18n/en";

// Server component so the page can carry metadata; PartnersDirectory owns the client boundary.
export const metadata: Metadata = {
  title: en.partners.title,
  description: en.partners.intro,
  alternates: { canonical: "/partners" },
};

export default function PartnersPage() {
  return <PartnersDirectory />;
}
