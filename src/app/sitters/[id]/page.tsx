import type { Metadata } from "next";
import SitterProfileClient from "./SitterProfileClient";
import { supabase } from "@/lib/supabase";

type Props = { params: Promise<{ id: string }> };

/**
 * Per-sitter title and description, so a shared link says who it is instead of
 * repeating the site-wide title 25 times.
 *
 * Only the three fields this page already renders in public are read — full_name,
 * city, about_me. profiles has a permissive SELECT policy that also exposes phone
 * numbers, and metadata is no reason to widen what leaves the database.
 *
 * The client component fetches the sitter again for the body. React's cache() cannot
 * dedupe across the server/client boundary, so this is genuinely a second read; it is
 * one indexed lookup against a 43-row table, which is a fair price for a real title.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const { data: sitter } = await supabase
    .from("profiles")
    .select("full_name, city, about_me")
    .eq("id", id)
    .eq("is_sitter", true)
    .maybeSingle();

  if (!sitter?.full_name) {
    // A missing or malformed id lands here. Nothing to describe, and nothing worth
    // indexing either.
    return { title: "Sitter", robots: { index: false, follow: true } };
  }

  // Cities are stored lowercase ("kaunas"), which the profile body renders as-is but
  // which reads as a typo in a browser tab or a search result.
  const city = sitter.city?.trim();
  const where = city ? ` in ${city.charAt(0).toUpperCase()}${city.slice(1)}` : "";
  const title = `${sitter.full_name} — pet sitter${where}`;
  const description = summarise(sitter.about_me) ?? `Book ${sitter.full_name} for walking, boarding, daycare or grooming on PetBnB.`;

  return {
    title,
    description,
    alternates: { canonical: `/sitters/${id}` },
    openGraph: { title: `${title} · PetBnB`, description, url: `/sitters/${id}` },
  };
}

/** The sitter's own words, clipped at a word boundary so a description never ends mid-word. */
function summarise(aboutMe: string | null): string | null {
  const text = aboutMe?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= 160) return text;
  const clipped = text.slice(0, 157);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 100 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

export default function SitterProfilePage() {
  return <SitterProfileClient />;
}
