import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo/site";

export const runtime = "edge";
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0f3d24 0%, #1f8a4c 45%, #3cb371 100%)",
          color: "#f6f9f4",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🎾
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>{SITE_NAME}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
          <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
            Любительский теннис в Беларуси
          </span>
          <span style={{ fontSize: 28, opacity: 0.92, lineHeight: 1.35 }}>
            Спарринг · тренеры · турниры · рейтинг
          </span>
        </div>

        <span style={{ fontSize: 22, opacity: 0.8 }}>www.playtennis.by</span>
      </div>
    ),
    { ...size },
  );
}
