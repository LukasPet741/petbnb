"use client";
import LegalDocument from "@/components/legal/LegalDocument";
import { PRIVACY_SECTIONS } from "@/lib/legal";

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" sections={PRIVACY_SECTIONS} />;
}
