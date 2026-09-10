import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque, Caveat } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import Atmosphere from "@/components/Atmosphere";
import en from "@/lib/i18n/en";
import { SITE_ORIGIN } from "@/lib/site";

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
  // Without this, every relative URL below is a build error and the OG card has no
  // absolute image to point at. See src/lib/site.ts for where the origin comes from.
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: en.common.meta.title,
    // Pages set a bare title and this frames it, so no page has to repeat the brand.
    template: "%s · PetBnB",
  },
  description: en.common.meta.description,
  applicationName: "PetBnB",
  openGraph: {
    type: "website",
    siteName: "PetBnB",
    locale: "lt_LT",
    url: "/",
    title: en.common.meta.title,
    description: en.common.meta.description,
  },
  twitter: {
    // opengraph-image.tsx supplies the picture; Twitter falls back to og:image,
    // so this only has to say how large to render it.
    card: "summary_large_image",
    title: en.common.meta.title,
    description: en.common.meta.description,
  },
};

// Phones: `viewportFit: "cover"` is what makes env(safe-area-inset-*) resolve to real
// values on notched iOS — without it every safe-area rule in the app is silently 0px.
// themeColor keeps the Chrome Android toolbar on --canvas instead of painting a grey
// seam above the sticky top bar. No maximumScale/userScalable: pinch-zoom stays on.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f6f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} ${caveat.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <Atmosphere />
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
