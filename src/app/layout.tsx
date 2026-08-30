import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, Caveat } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import Atmosphere from "@/components/Atmosphere";
import en from "@/lib/i18n/en";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display face: a distinctive geometric-humanist sans, not a serif.
// Chosen over Space Grotesk / Sora / Manrope for its irregular, hand-built
// letterforms (single-story "a", warm curve terminals) that read as crafted
// rather than corporate-cold, while staying a bold sans for headlines.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

// Script accent: ONE controlled micro-use only, the sitter's signed name
// in the hero quote. Not a general display font.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-caveat",
  display: "swap",
});

// Locale in this app is a client-only preference (see LanguageContext, which reads
// localStorage after mount), so it isn't known yet when this static metadata is
// generated on the server. These strings mirror src/lib/i18n's common.meta English
// copy — kept there as the single source of truth — rather than being hardcoded here.
export const metadata: Metadata = {
  title: en.common.meta.title,
  description: en.common.meta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} ${caveat.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <Atmosphere />
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
