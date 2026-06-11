import { ImageResponse } from "next/og";
import { getOgCopy, type OgCopy, type OgPillar } from "./og-copy";
import { loadOgFonts } from "./og-fonts";
import { SITE_NAME } from "./site";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

function PillarCard({ pillar }: { pillar: OgPillar }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        padding: "22px 20px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `linear-gradient(145deg, ${pillar.accent}33, rgba(255,255,255,0.12))`,
            border: `2px solid ${pillar.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
          }}
        >
          {pillar.emoji}
        </div>
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#f6f9f4",
            letterSpacing: -0.5,
          }}
        >
          {pillar.title}
        </span>
      </div>
      <span
        style={{
          fontSize: 17,
          lineHeight: 1.4,
          color: "rgba(246,249,244,0.88)",
          fontWeight: 600,
        }}
      >
        {pillar.body}
      </span>
    </div>
  );
}

function OgImageLayout({ copy }: { copy: OgCopy }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "48px 52px 44px",
        background: "linear-gradient(145deg, #0B2E1B 0%, #155E36 38%, #1F8A4C 72%, #187341 100%)",
        color: "#f6f9f4",
        fontFamily: "Inter",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative glow */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(215,242,5,0.22) 0%, transparent 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -60,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(67,178,111,0.25) 0%, transparent 70%)",
        }}
      />

      {/* Court lines */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(255,255,255,0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          marginLeft: -1,
          width: 2,
          height: 120,
          background: "rgba(255,255,255,0.06)",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 36,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "linear-gradient(145deg, #D7F205, #B5CB04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              boxShadow: "0 8px 24px rgba(215,242,5,0.35)",
            }}
          >
            🎾
          </div>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>{SITE_NAME}</span>
        </div>
        <div
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          {copy.badge}
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 32,
          maxWidth: 900,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 46,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -1.2,
          }}
        >
          {copy.headline}
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "rgba(246,249,244,0.85)",
            lineHeight: 1.35,
          }}
        >
          {copy.subheadline}
        </span>
      </div>

      {/* Three pillars */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 18,
          flex: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        {copy.pillars.map((pillar) => (
          <PillarCard key={pillar.title} pillar={pillar} />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 28,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 700, opacity: 0.9 }}>{copy.domain}</span>
        <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.65 }}>{copy.region}</span>
      </div>
    </div>
  );
}

/** Renders the branded 1200×630 share image for Open Graph / Twitter. */
export async function createPlayTennisOgImage(locale: string) {
  const copy = getOgCopy(locale);
  const fonts = await loadOgFonts();

  return new ImageResponse(<OgImageLayout copy={copy} />, {
    ...OG_IMAGE_SIZE,
    fonts,
  });
}

export function getOgImageAlt(locale: string): string {
  return getOgCopy(locale).imageAlt;
}
