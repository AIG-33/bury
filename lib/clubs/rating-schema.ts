import { z } from "zod";
import { DEFAULT_RATING_CONFIG, type RatingConfig } from "@/lib/rating/elo";

// =============================================================================
// Per-club rating configuration.
//
// Clubs reuse the site's Elo engine (lib/rating/elo.ts) but with their own
// tunables. Unlike the global AlgorithmConfig, a club has NO onboarding quiz,
// so the start rating is a single fixed number (`start_rating`) rather than the
// quiz-derived `start_elo` block. K-factors and multipliers mirror the global
// shape so the same engine + simulator can be reused.
//
// Defaults mirror the site-wide DEFAULT_ALGORITHM_CONFIG / DEFAULT_RATING_CONFIG.
// =============================================================================

export const ClubRatingConfigSchema = z.object({
  /** Rating every player starts the club ladder at. */
  start_rating: z.coerce.number().int().min(100).max(3000),
  /** Ratings never drop below this. */
  floor: z.coerce.number().int().min(0).max(3000),
  k_factors: z.object({
    provisional: z.coerce.number().int().min(8).max(80),
    intermediate: z.coerce.number().int().min(8).max(80),
    established: z.coerce.number().int().min(8).max(80),
    provisional_until_n_matches: z.coerce.number().int().min(0).max(50),
    intermediate_until_n_matches: z.coerce.number().int().min(1).max(200),
  }),
  multipliers: z.object({
    friendly: z.coerce.number().min(0).max(3),
    tournament: z.coerce.number().min(0).max(3),
    tournament_final: z.coerce.number().min(0).max(3),
  }),
});

export type ClubRatingConfig = z.infer<typeof ClubRatingConfigSchema>;

export const DEFAULT_CLUB_RATING_CONFIG: ClubRatingConfig = {
  start_rating: 1000,
  floor: 100,
  k_factors: {
    provisional: 40,
    intermediate: 32,
    established: 20,
    provisional_until_n_matches: 5,
    intermediate_until_n_matches: 30,
  },
  multipliers: {
    friendly: 0.5,
    tournament: 1.0,
    tournament_final: 1.25,
  },
};

/**
 * Map a club rating config to the pure Elo engine input. Mirrors
 * lib/rating/config.ts#algorithmConfigToRatingConfig (divisor/elite are not
 * club-tunable in this first version — kept identical to the site engine).
 */
export function clubRatingConfigToRatingConfig(c: ClubRatingConfig): RatingConfig {
  return {
    divisor: 400,
    floor: c.floor,
    provisional_threshold: c.k_factors.provisional_until_n_matches,
    k_provisional: c.k_factors.provisional,
    k_intermediate: c.k_factors.intermediate,
    k_established: c.k_factors.established,
    elite_elo_threshold: 2200,
    k_elite: Math.max(8, Math.round(c.k_factors.established * 0.8)),
    multipliers: {
      friendly: c.multipliers.friendly,
      tournament: c.multipliers.tournament,
      tournament_final: c.multipliers.tournament_final,
      league: c.multipliers.tournament,
    },
  };
}

/** Parse a raw JSONB `config` value, falling back to the default on garbage. */
export function clubRatingConfigFromRow(config: unknown): ClubRatingConfig {
  const parsed = ClubRatingConfigSchema.safeParse(config);
  return parsed.success ? parsed.data : DEFAULT_CLUB_RATING_CONFIG;
}

/** Engine config derived from a raw JSONB row (never throws). */
export function clubRatingConfigToEngine(config: unknown): RatingConfig {
  const parsed = ClubRatingConfigSchema.safeParse(config);
  if (!parsed.success) return DEFAULT_RATING_CONFIG;
  return clubRatingConfigToRatingConfig(parsed.data);
}

// ─── Club page customization ────────────────────────────────────────────────

export const CLUB_PAGE_BLOCKS = ["rating", "tournaments", "roster", "venues"] as const;
export type ClubPageBlock = (typeof CLUB_PAGE_BLOCKS)[number];

export const ClubPageBlocksSchema = z.object({
  rating: z.boolean(),
  tournaments: z.boolean(),
  roster: z.boolean(),
  venues: z.boolean(),
});
export type ClubPageBlocks = z.infer<typeof ClubPageBlocksSchema>;

export const DEFAULT_CLUB_PAGE_BLOCKS: ClubPageBlocks = {
  rating: true,
  tournaments: true,
  roster: true,
  venues: true,
};

export function clubPageBlocksFromRow(value: unknown): ClubPageBlocks {
  const parsed = ClubPageBlocksSchema.partial().safeParse(value);
  if (!parsed.success) return DEFAULT_CLUB_PAGE_BLOCKS;
  return { ...DEFAULT_CLUB_PAGE_BLOCKS, ...parsed.data };
}

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "brand_color_invalid");

// ─── Owner-facing forms ───────────────────────────────────────────────────────

export const ClubPageSettingsSchema = z.object({
  club_id: z.string().uuid(),
  brand_color: z.preprocess(
    (v) => (v == null || v === "" ? null : v),
    hexColor.nullable(),
  ),
  cover_url: z.preprocess(
    (v) => (v == null || v === "" ? null : v),
    z.string().max(500).nullable(),
  ),
  blocks: ClubPageBlocksSchema,
});
export type ClubPageSettings = z.infer<typeof ClubPageSettingsSchema>;

// Blocks-only update — visual branding moved to clubs.branding
// (lib/validators/club-branding.ts), so the blocks toggle saves separately.
export const ClubPageBlocksInputSchema = z.object({
  club_id: z.string().uuid(),
  blocks: ClubPageBlocksSchema,
});
export type ClubPageBlocksInput = z.infer<typeof ClubPageBlocksInputSchema>;

export const ClubRatingSettingsSchema = z.object({
  club_id: z.string().uuid(),
  enabled: z.boolean(),
  label: z.preprocess(
    (v) => {
      if (v == null) return null;
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t.length === 0 ? null : t;
    },
    z.string().max(60).nullable(),
  ),
  config: ClubRatingConfigSchema,
});
export type ClubRatingSettingsInput = z.infer<typeof ClubRatingSettingsSchema>;

export const AdjustClubRatingSchema = z.object({
  club_id: z.string().uuid(),
  player_id: z.string().uuid(),
  // New absolute rating value the owner sets the player to.
  new_rating: z.coerce.number().int().min(0).max(3000),
  note: z.preprocess(
    (v) => {
      if (v == null) return null;
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t.length === 0 ? null : t;
    },
    z.string().max(300).nullable(),
  ),
});
export type AdjustClubRatingInput = z.infer<typeof AdjustClubRatingSchema>;
