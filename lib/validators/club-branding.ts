import { z } from "zod";
import {
  TournamentBrandingSchema,
  DEFAULT_TOURNAMENT_BRANDING,
  hasBranding,
  type TournamentBranding,
} from "@/lib/validators/tournament-branding";

// =============================================================================
// Club page branding config.
//
// Stored as the JSONB column `clubs.branding` (see the 20260713120000
// migration). Deliberately the SAME shape as tournaments.branding so both
// public pages share one render pipeline (lib/tournaments/branding.ts) and
// one editor vocabulary. Per AGENTS.md §7 every JSONB column has a Zod
// schema here — this one delegates to TournamentBrandingSchema, which
// already strictly sanitises colors and image URLs for inline-CSS safety.
// =============================================================================

export const ClubBrandingSchema = TournamentBrandingSchema;
export type ClubBranding = TournamentBranding;

export const DEFAULT_CLUB_BRANDING: ClubBranding = DEFAULT_TOURNAMENT_BRANDING;

/**
 * Parse a raw JSONB `branding` value, always returning a well-formed object.
 * Falls back to defaults for legacy/empty/garbage rows — never throws.
 */
export function clubBrandingFromRow(value: unknown): ClubBranding {
  const parsed = ClubBrandingSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_CLUB_BRANDING;
}

/** True when the owner has customised anything (drives hero fallbacks). */
export const hasClubBranding = hasBranding;

/**
 * Fold the legacy `clubs.brand_color` / `clubs.cover_url` columns into the
 * branding blob (blob wins when both are set). Legacy values only apply when
 * they pass the strict branding validation — a malformed legacy value simply
 * stays ignored rather than throwing.
 */
export function clubBrandingWithLegacy(
  branding: ClubBranding,
  legacyBrandColor: string | null,
  legacyCoverUrl: string | null,
): ClubBranding {
  const candidate = {
    ...branding,
    accent_color: branding.accent_color ?? legacyBrandColor,
    banner_url: branding.banner_url ?? legacyCoverUrl,
  };
  const parsed = ClubBrandingSchema.safeParse(candidate);
  return parsed.success ? parsed.data : branding;
}

// ─── Server-action input ──────────────────────────────────────────────────────

export const UpdateClubBrandingSchema = z.object({
  club_id: z.string().uuid(),
  branding: ClubBrandingSchema,
});
export type UpdateClubBrandingInput = z.infer<typeof UpdateClubBrandingSchema>;
