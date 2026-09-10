import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { PRIVACY_SECTIONS } from "@/lib/legal";
import en from "@/lib/i18n/en";

// Server component for the same reason as the terms page: metadata is server-only,
// and LegalDocument already owns the client boundary.
export const metadata: Metadata = {
  title: en.legal.privacy.title,
  description: "What PetBnB collects, why it collects it, and what it does with it.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" sections={PRIVACY_SECTIONS} />;
}
