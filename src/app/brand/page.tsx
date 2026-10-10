import type { Metadata } from "next";
import BrandSheet from "@/components/brand/BrandSheet";
import en from "@/lib/i18n/en";

// Server component so the page can carry metadata; BrandSheet owns the client boundary.
export const metadata: Metadata = {
  title: en.brand.title,
  description: en.brand.intro,
  alternates: { canonical: "/brand" },
};

export default function BrandPage() {
  return <BrandSheet />;
}
