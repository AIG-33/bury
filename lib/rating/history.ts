import { createSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Read-only helpers for the player's "Rating" tab.
// =============================================================================

export type EloPoint = {
  id: string;
  created_at: string;
  old_elo: number;
  new_elo: number;
  delta: number;
  k_factor: number;
  multiplier: number;
  reason: "match" | "manual_adjustment" | "onboarding" | "seasonal_decay";
  match_id: string | null;
};

export type EloHero = {
  current_elo: number;
  elo_status: "provisional" | "established";
  rated_matches_count: number;
  delta_30d: number;
  best_elo: number;
  worst_elo: number;
};

export type SeasonInfo = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: "upcoming" | "active" | "closed";
  top_n_for_prizes: number;
  prizes_description: string | null;
  // The race standings/score per player are computed separately in iter 12.
  // For now the widget renders only the season meta + days_left.
  days_left: number;
} | null;

export type TopCoach = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  coach_avg_rating: number | null;
  coach_reviews_count: number;
  city: string | null;
};

export type RatingTabPayload = {
  hero: EloHero;
  history: EloPoint[];
  season: SeasonInfo;
  topCoaches: TopCoach[];
};

const HISTORY_LIMIT = 20;

export async function loadMyRatingTab(): Promise<RatingTabPayload | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, historyRes, seasonRes, topCoachesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("current_elo, elo_status, rated_matches_count")
      .eq("id", user.id)
      .single(),
    supabase
      .from("rating_history")
      .select(
        "id, created_at, old_elo, new_elo, delta, k_factor, multiplier, reason, match_id",
      )
      .eq("player_id", user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("seasons")
      .select(
        "id, name, starts_on, ends_on, status, top_n_for_prizes, prizes_description",
      )
      .eq("status", "active")
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, coach_avg_rating, coach_reviews_count, city",
      )
      .eq("is_coach", true)
      .gte("coach_reviews_count", 1)
      .order("coach_avg_rating", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  const profile = (profileRes.data as {
    current_elo: number;
    elo_status: "provisional" | "established";
    rated_matches_count: number;
  } | null) ?? {
    current_elo: 1000,
    elo_status: "provisional" as const,
    rated_matches_count: 0,
  };

  const history = ((historyRes.data ?? []) as EloPoint[])
    // chart consumes oldest → newest
    .slice()
    .reverse();

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = history.filter((p) => Date.parse(p.created_at) >= thirtyDaysAgo);
  const delta_30d = recent.reduce((sum, p) => sum + (p.delta ?? 0), 0);
  const allElos = history.length > 0 ? history.map((p) => p.new_elo) : [profile.current_elo];

  const hero: EloHero = {
    current_elo: profile.current_elo,
    elo_status: profile.elo_status,
    rated_matches_count: profile.rated_matches_count,
    delta_30d,
    best_elo: Math.max(...allElos),
    worst_elo: Math.min(...allElos),
  };

  const seasonRow = seasonRes.data as
    | {
        id: string;
        name: string;
        starts_on: string;
        ends_on: string;
        status: "upcoming" | "active" | "closed";
        top_n_for_prizes: number;
        prizes_description: string | null;
      }
    | null;

  const season: SeasonInfo = seasonRow
    ? {
        ...seasonRow,
        days_left: Math.max(
          0,
          Math.ceil(
            (Date.parse(seasonRow.ends_on) - Date.now()) / (24 * 60 * 60 * 1000),
          ),
        ),
      }
    : null;

  const topCoaches = (topCoachesRes.data ?? []) as TopCoach[];

  return { hero, history, season, topCoaches };
}
