// =============================================================================
// Read-only helpers for the external-rating timeline.
//
// Mirrors the shape of `lib/rating/history.ts` (which serves the internal
// Elo chart) but reads from `external_rating_history`. Singles and doubles
// are returned as independent arrays so the chart can render them as two
// lines.
// =============================================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ExternalEloPoint = {
  id: string;
  created_at: string;
  old_elo: number | null;
  new_elo: number;
  delta: number;
  discipline: "singles" | "doubles";
  display_tier_old: string | null;
  display_tier_new: string;
  is_calibrating: boolean;
  reason: "initial_import" | "manual_refresh" | "admin_set";
};

export type ExternalRatingTimeline = {
  current: {
    source: "liga_tennisa";
    external_id: string;
    external_url: string;
    external_elo: number;
    external_elo_doubles: number | null;
    display_tier: string;
    is_calibrating_singles: boolean;
    is_calibrating_doubles: boolean;
    last_refreshed_at: string;
    last_refresh_error: string | null;
  } | null;
  /** Newest → oldest is database order, but this array is reversed for charts. */
  singles: ExternalEloPoint[];
  doubles: ExternalEloPoint[];
  delta_30d: number;
  best_elo: number;
  worst_elo: number;
  refreshed_count: number;
};

const HISTORY_LIMIT = 200;

type ExternalRatingRow = {
  source: "liga_tennisa";
  external_id: string;
  external_url: string;
  external_elo: number;
  external_elo_doubles: number | null;
  display_tier: string;
  is_calibrating_singles: boolean;
  is_calibrating_doubles: boolean;
  last_refreshed_at: string;
  last_refresh_error: string | null;
};

/**
 * Build the timeline payload from the two raw queries. Pure helper so the
 * authenticated and the public variants share the math (and so it can be
 * unit-tested without a Supabase mock).
 *
 * @internal exported for tests only
 */
export function buildTimeline(
  current: ExternalRatingRow | null,
  rows: ExternalEloPoint[],
): ExternalRatingTimeline {
  // Chart wants oldest → newest.
  const ordered = rows.slice().reverse();
  const singles = ordered.filter((r) => r.discipline === "singles");
  const doubles = ordered.filter((r) => r.discipline === "doubles");

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSingles = singles.filter(
    (p) => Date.parse(p.created_at) >= thirtyDaysAgo,
  );
  const delta_30d = recentSingles.reduce((sum, p) => sum + p.delta, 0);

  const allSinglesElos =
    singles.length > 0
      ? singles.map((p) => p.new_elo)
      : current
        ? [current.external_elo]
        : [];
  const best_elo = allSinglesElos.length > 0 ? Math.max(...allSinglesElos) : 0;
  const worst_elo = allSinglesElos.length > 0 ? Math.min(...allSinglesElos) : 0;

  // refreshed_count = number of manual_refresh points across both disciplines.
  const refreshed_count = rows.filter((r) => r.reason === "manual_refresh").length;

  return {
    current,
    singles,
    doubles,
    delta_30d,
    best_elo,
    worst_elo,
    refreshed_count,
  };
}

async function loadFor(
  playerId: string,
): Promise<ExternalRatingTimeline | null> {
  const supabase = await createSupabaseServerClient();

  const { data: current } = (await supabase
    .from("external_ratings")
    .select(
      "source, external_id, external_url, external_elo, external_elo_doubles, " +
        "display_tier, is_calibrating_singles, is_calibrating_doubles, " +
        "last_refreshed_at, last_refresh_error",
    )
    .eq("player_id", playerId)
    .eq("source", "liga_tennisa")
    .maybeSingle()) as { data: ExternalRatingRow | null };

  // Even without a current ext_ratings row, we don't return null straight
  // away — the player might have disconnected, but wait: cascade deletes the
  // history too. So if `current` is null, there's no history either. Bail.
  if (!current) return null;

  const { data: rows } = (await supabase
    .from("external_rating_history")
    .select(
      "id, created_at, old_elo, new_elo, delta, discipline, " +
        "display_tier_old, display_tier_new, is_calibrating, reason",
    )
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT)) as { data: ExternalEloPoint[] | null };

  return buildTimeline(current, rows ?? []);
}

export async function loadMyExternalRatingTimeline(): Promise<ExternalRatingTimeline | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return loadFor(user.id);
}

export async function loadExternalRatingTimelineForPlayer(
  playerId: string,
): Promise<ExternalRatingTimeline | null> {
  return loadFor(playerId);
}
