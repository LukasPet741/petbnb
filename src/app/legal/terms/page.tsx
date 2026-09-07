"use client";
import LegalDocument from "@/components/legal/LegalDocument";
import { TERMS_SECTIONS } from "@/lib/legal";

export default function TermsPage() {
  return <LegalDocument doc="terms" sections={TERMS_SECTIONS} />;
}
