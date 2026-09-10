import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { TERMS_SECTIONS } from "@/lib/legal";
import en from "@/lib/i18n/en";

// This page needed no "use client" of its own: LegalDocument carries the directive,
// and a server component may render a client one. Dropping it is what lets the route
// export metadata at all — the Metadata APIs are server-only.
//
// The copy is English because metadata is resolved on the server and locale in this
// app is a client-side preference read from localStorage after mount. Same reason the
// root layout's title is English. Search engines see one language; visitors see theirs.
export const metadata: Metadata = {
  title: en.legal.terms.title,
  description: "The terms you agree to when using PetBnB to book or offer pet care.",
  alternates: { canonical: "/legal/terms" },
};

export default function TermsPage() {
  return <LegalDocument doc="terms" sections={TERMS_SECTIONS} />;
}
