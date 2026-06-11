// =============================================================================
// Bridge between the admin-managed `rating_algorithm_config` table and the
// pure Elo engine (lib/rating/elo.ts).
//
// The DB stores the broader `AlgorithmConfig` JSONB (start Elo, season, …);
// the engine consumes the narrow `RatingConfig`. Mapping mirrors the admin
// simulator (app/[locale]/(admin)/admin/rating/actions.ts) so "what the
// simulator predicts" === "what a real match applies".
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlgorithmConfigSchema, type AlgorithmConfig } from "@/lib/quiz/schema";
import { DEFAULT_RATING_CONFIG, type RatingConfig } from "./elo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

/** Map the admin-facing DB config to the engine's input. */
export function algorithmConfigToRatingConfig(c: AlgorithmConfig): RatingConfig {
  return {
    divisor: 400,
    floor: 100,
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

/**
 * Parse a raw JSONB `config` column value into a RatingConfig. Falls back to
 * DEFAULT_RATING_CONFIG when the payload is missing or malformed, so a broken
 * admin row can never block match scoring.
 */
export function ratingConfigFromRow(config: unknown): RatingConfig {
  const parsed = AlgorithmConfigSchema.safeParse(config);
  if (!parsed.success) return DEFAULT_RATING_CONFIG;
  return algorithmConfigToRatingConfig(parsed.data);
}

/**
 * Load the active rating config (admin-activated at /admin/rating).
 * `rating_algorithm_config` is world-readable (`algo_read` RLS policy), so
 * this works with any client. Returns DEFAULT_RATING_CONFIG when there is no
 * active row or it fails to parse.
 */
export async function loadActiveRatingConfig(
  supabase: AnySupabase,
): Promise<RatingConfig> {
  const { data } = (await supabase
    .from("rating_algorithm_config")
    .select("config")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { config: unknown } | null };
  if (!data) return DEFAULT_RATING_CONFIG;
  return ratingConfigFromRow(data.config);
}
