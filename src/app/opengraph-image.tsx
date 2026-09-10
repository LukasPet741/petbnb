import { ImageResponse } from "next/og";
import en from "@/lib/i18n/en";

export const alt = en.common.meta.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card that shows when the site is pasted into a chat or a timeline.
 *
 * Satori supports flexbox and a subset of CSS — no grid, and any element with more
 * than one child needs an explicit `display: flex`. Colours are the app's own tokens
 * from globals.css, written literally because that stylesheet is never loaded here.
 *
 * No custom font is passed: the display face is a next/font/google asset with no .ttf
 * on disk to read, and the alternative is a build-time download. The layout carries
 * the identity instead of the typeface.
 */
export default function OpengraphImage() {
  const canvas = "#f4f6f4";
  const brand = "#1f5c47";
  const ink = "#131a17";
  const inkSoft = "#56635c";
  const amber = "#dc9a35";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: canvas,
          padding: "0 88px",
          position: "relative",
        }}
      >
        {/* Weight in the corner, bleeding off two edges so the card does not read
            as a centred text slide. */}
        <div
          style={{
            position: "absolute",
            right: -200,
            bottom: -260,
            width: 620,
            height: 620,
            borderRadius: 620,
            background: brand,
            opacity: 0.1,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -90,
            bottom: -150,
            width: 380,
            height: 380,
            borderRadius: 380,
            background: brand,
            opacity: 0.14,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", marginBottom: 34 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 18,
              background: amber,
              marginRight: 16,
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 28,
              color: inkSoft,
              letterSpacing: 2,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            petbnb.lt
          </div>
        </div>

        <div
          style={{
            fontSize: 82,
            fontWeight: 700,
            color: brand,
            lineHeight: 1.08,
            maxWidth: 880,
            display: "flex",
          }}
        >
          Pet sitters near you in Lithuania
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 34,
            color: ink,
            opacity: 0.72,
            maxWidth: 760,
            display: "flex",
          }}
        >
          Walking, boarding, daycare and grooming. Book in minutes.
        </div>

        <div
          style={{
            marginTop: 56,
            height: 6,
            width: 132,
            borderRadius: 6,
            background: amber,
            display: "flex",
          }}
        />
      </div>
    ),
    size
  );
}
