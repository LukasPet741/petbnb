import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { ADVERTISING_SECTIONS } from "@/lib/legal";
import en from "@/lib/i18n/en";

// Same shape as the terms page: a server component for the metadata, LegalDocument for the copy.
export const metadata: Metadata = {
  title: en.legal.advertising.title,
  description: "The terms for businesses that pay for Promoted placement on the PetBnB places map.",
  alternates: { canonical: "/legal/advertising" },
};

export default function AdvertisingTermsPage() {
  return <LegalDocument doc="advertising" sections={ADVERTISING_SECTIONS} />;
}
