// =============================================================================
// Pure helpers that turn a validated TournamentBranding into a safe, accessible
// set of render instructions (CSS variables, resolved text colors, clamped
// scrim opacity). No React / DOM here so it is unit-testable and reusable by
// both the RSC renderer and (future) OG-image generation.
//
// Accessibility: text placed over the banner sits on top of a dark scrim, so
// it is always light (#fff) and legible regardless of the uploaded image. For
// the flat themed background we auto-pick dark or light body text based on the
// background's relative luminance (WCAG 2.1).
// =============================================================================

import {
  type TournamentBranding,
  type CornerStyle,
} from "@/lib/validators/tournament-branding";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export type Rgb = { r: number; g: number; b: number };

/** Defensive re-validation: only ever emit a color that matches #RRGGBB. */
export function sanitizeHex(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return HEX_RE.test(v) ? v.toLowerCase() : null;
}

export function hexToRgb(hex: string): Rgb | null {
  const safe = sanitizeHex(hex);
  if (!safe) return null;
  return {
    r: parseInt(safe.slice(1, 3), 16),
    g: parseInt(safe.slice(3, 5), 16),
    b: parseInt(safe.slice(5, 7), 16),
  };
}

/** WCAG relative luminance for an sRGB color (0 = black … 1 = white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio (1..21) between two hex colors. */
export function contrastRatio(hex1: string, hex2: string): number {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  if (!a || !b) return 1;
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Site defaults: near-black ink text and (almost) white.
export const INK_TEXT = "#0f1b14";
export const LIGHT_TEXT = "#ffffff";

/** Pick the body text color with the best contrast over `background`. */
export function readableTextOn(background: string | null): string {
  const safe = sanitizeHex(background);
  if (!safe) return INK_TEXT;
  return contrastRatio(safe, INK_TEXT) >= contrastRatio(safe, LIGHT_TEXT)
    ? INK_TEXT
    : LIGHT_TEXT;
}

// Never let the banner scrim drop so low that overlaid text becomes unreadable,
// and never make it fully opaque (that would hide the image entirely).
export const MIN_SCRIM = 0.28;
export const MAX_SCRIM = 0.85;

export function resolveScrimOpacity(requested: number): number {
  if (!Number.isFinite(requested)) return MIN_SCRIM;
  return Math.min(MAX_SCRIM, Math.max(MIN_SCRIM, requested));
}

export type RoomTheme = {
  /** Whether any visual theming applies (banner/background/accent). */
  themed: boolean;
  /** Inline style for the full-width room background. */
  backgroundStyle: Record<string, string>;
  /** Body text color chosen for contrast against the background. */
  textColor: string;
  /** Muted variant of the body text (for subtitles). */
  mutedTextColor: string;
  accentColor: string | null;
  /** Text color that reads well ON the accent color (for accent buttons). */
  onAccentColor: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  /** CSS `background-image` value for the banner, or null. */
  bannerImageStyle: string | null;
  scrimOpacity: number;
  /** Tailwind radius class driven by the corner style. */
  radiusClass: string;
  fontClass: string;
  cornerStyle: CornerStyle;
};

const FONT_CLASS: Record<TournamentBranding["font_pairing"], string> = {
  default: "",
  classic: "font-serif",
  modern: "font-sans tracking-tight",
};

/**
 * Build a fully-sanitized theme from branding. Colors are re-validated here
 * (defense in depth) so even a malformed stored value cannot inject CSS.
 */
export function buildRoomTheme(branding: TournamentBranding): RoomTheme {
  const bg = sanitizeHex(branding.background_color);
  const gradientTo = sanitizeHex(branding.background_gradient_to);
  const accent = sanitizeHex(branding.accent_color);
  const bannerUrl = branding.banner_url;
  const logoUrl = branding.logo_url;

  const backgroundStyle: Record<string, string> = {};
  if (bg && gradientTo) {
    backgroundStyle.background = `linear-gradient(160deg, ${bg} 0%, ${gradientTo} 100%)`;
  } else if (bg) {
    backgroundStyle.backgroundColor = bg;
  }

  const textColor = readableTextOn(gradientTo ?? bg);
  const mutedTextColor = textColor === INK_TEXT ? "#4b5a51" : "rgba(255,255,255,0.82)";

  const themed = Boolean(bg || accent || bannerUrl || logoUrl);

  return {
    themed,
    backgroundStyle,
    textColor,
    mutedTextColor,
    accentColor: accent,
    onAccentColor: accent ? readableTextOn(accent) : LIGHT_TEXT,
    logoUrl,
    bannerUrl,
    // Banner url is already validated (safeImageUrl) — no quotes/parens/spaces —
    // so it cannot terminate the url("…") token. Still wrapped in quotes.
    bannerImageStyle: bannerUrl ? `url("${bannerUrl}")` : null,
    scrimOpacity: resolveScrimOpacity(branding.banner_overlay_opacity),
    radiusClass: branding.corner_style === "sharp" ? "rounded-none" : "rounded-2xl",
    fontClass: FONT_CLASS[branding.font_pairing] ?? "",
    cornerStyle: branding.corner_style,
  };
}
