import { z } from "zod";

// =============================================================================
// Tournament "room" branding config.
//
// Stored as a single JSONB column `tournaments.branding` (see the
// 20260713* migration). Kept as one cohesive blob — it is always read and
// written as a unit by the organizer's branding editor — rather than a wide
// set of columns. Per AGENTS.md §7 every JSONB column has a Zod schema here.
//
// SECURITY: this object is rendered into inline CSS (background color/gradient,
// background-image url) on a PUBLIC page. Every field is therefore strictly
// validated so a malicious organizer can't inject arbitrary CSS/markup:
//   * colors must match #RRGGBB exactly,
//   * image URLs must be http(s) and contain no characters that could break
//     out of a CSS `url("…")` context (quotes, parens, backslashes, spaces,
//     control chars). Combined with the storage bucket policy this means only
//     the organizer's own uploaded assets can ever be referenced.
// =============================================================================

export const THEME_PRESETS = ["light", "dark", "auto"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const CORNER_STYLES = ["rounded", "sharp"] as const;
export type CornerStyle = (typeof CORNER_STYLES)[number];

// A deliberately tiny, safe set of font pairings. The actual font stacks live
// in the renderer — this is just a key so organizers can't inject font-family.
export const FONT_PAIRINGS = ["default", "classic", "modern"] as const;
export type FontPairing = (typeof FONT_PAIRINGS)[number];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const nullableHex = z.preprocess(
  (v) => (v == null || v === "" ? null : v),
  z.string().trim().regex(HEX_RE, "branding_color_invalid").nullable(),
);

// Only allow http(s) URLs with no characters that could escape a CSS
// url("…") context or introduce a javascript: scheme.
const UNSAFE_URL_RE = /["'()\\<>]|\s|[\u0000-\u001f]/;
const safeImageUrl = z.preprocess(
  (v) => (v == null || v === "" ? null : v),
  z
    .string()
    .trim()
    .max(1000)
    .refine((u) => /^https:\/\//i.test(u) || /^http:\/\//i.test(u), "branding_url_invalid")
    .refine((u) => !UNSAFE_URL_RE.test(u), "branding_url_unsafe")
    .nullable(),
);

const nullableText = (max: number) =>
  z.preprocess((v) => {
    if (v == null) return null;
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, z.string().max(max).nullable());

export const SponsorSchema = z.object({
  name: z.string().trim().min(1, "sponsor_name_required").max(80),
  logo_url: safeImageUrl,
  // Sponsor website. Bare domains are normalised to https:// so organizers
  // can paste "sponsor.by" and still get a working link.
  url: z.preprocess(
    (v) => {
      if (v == null) return null;
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      if (trimmed.length === 0) return null;
      return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    },
    z
      .string()
      .max(1000)
      .refine((u) => /^https?:\/\//i.test(u), "branding_url_invalid")
      .nullable(),
  ),
});
export type Sponsor = z.infer<typeof SponsorSchema>;

export const TournamentBrandingSchema = z.object({
  /** light / dark / auto (auto follows the viewer's OS preference). */
  theme_preset: z.enum(THEME_PRESETS).default("light"),
  /** Page background color. Null → inherit the site default look. */
  background_color: nullableHex,
  /** Optional second stop → renders a subtle linear gradient with background_color. */
  background_gradient_to: nullableHex,
  /** Accent (primary) color applied to CTA, chips, logo ring, accent bar. */
  accent_color: nullableHex,
  /** Uploaded logo (public URL in the tournament-branding bucket). */
  logo_url: safeImageUrl,
  /** Full-width hero banner behind the title (public URL). */
  banner_url: safeImageUrl,
  /**
   * Darkening scrim opacity over the banner (0..1) so overlaid text stays
   * legible. The renderer additionally clamps this to a safe minimum.
   */
  banner_overlay_opacity: z.coerce.number().min(0).max(1).default(0.45),
  corner_style: z.enum(CORNER_STYLES).default("rounded"),
  font_pairing: z.enum(FONT_PAIRINGS).default("default"),
  /** Optional custom room title (defaults to the tournament name when null). */
  title_override: nullableText(120),
  /** Optional short tagline shown under the title. */
  tagline: nullableText(200),
  /** Optional sponsor logo strip. */
  sponsors: z.array(SponsorSchema).max(12).default([]),
});

export type TournamentBranding = z.infer<typeof TournamentBrandingSchema>;

export const DEFAULT_TOURNAMENT_BRANDING: TournamentBranding = {
  theme_preset: "light",
  background_color: null,
  background_gradient_to: null,
  accent_color: null,
  logo_url: null,
  banner_url: null,
  banner_overlay_opacity: 0.45,
  corner_style: "rounded",
  font_pairing: "default",
  title_override: null,
  tagline: null,
  sponsors: [],
};

/**
 * Parse a raw JSONB `branding` value, always returning a well-formed object.
 * Written data is always valid (validated on the way in), so the fallback to
 * defaults only fires for legacy/empty/garbage rows — never throws.
 */
export function tournamentBrandingFromRow(value: unknown): TournamentBranding {
  const parsed = TournamentBrandingSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_TOURNAMENT_BRANDING;
}

/** True when the organizer has customised anything (used to decide fallbacks). */
export function hasBranding(b: TournamentBranding): boolean {
  return (
    b.background_color != null ||
    b.accent_color != null ||
    b.logo_url != null ||
    b.banner_url != null ||
    b.tagline != null ||
    b.title_override != null ||
    b.sponsors.length > 0 ||
    b.theme_preset !== "light" ||
    b.corner_style !== "rounded" ||
    b.font_pairing !== "default"
  );
}

// ─── Server-action input ──────────────────────────────────────────────────────

export const UpdateTournamentBrandingSchema = z.object({
  tournament_id: z.string().uuid(),
  branding: TournamentBrandingSchema,
});
export type UpdateTournamentBrandingInput = z.infer<typeof UpdateTournamentBrandingSchema>;
