import type { Metadata } from "next";
import SittersClient from "./SittersClient";
import en from "@/lib/i18n/en";

/**
 * A server shell whose only job is to carry metadata. The directory itself is the
 * interactive part and stays a client component in SittersClient.tsx — the Metadata
 * APIs are server-only, so a `use client` page can never describe itself to a crawler.
 */
export const metadata: Metadata = {
  title: en.sitters.browse.title,
  description: en.sitters.browse.subtitle,
  alternates: { canonical: "/sitters" },
  openGraph: {
    title: `${en.sitters.browse.title} · PetBnB`,
    description: en.sitters.browse.subtitle,
    url: "/sitters",
  },
};

export default function SittersPage() {
  return <SittersClient />;
}
