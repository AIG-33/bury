import { createSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Read-only helpers for the player's "Rating" tab.
//
// The tab is discipline-aware: singles and doubles are two fully separate
// ladders, so every query (profile columns, history rows, match list) is
// filtered by the requested discipline.
// =============================================================================

export type RatingDiscipline = "singles" | "doubles";

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

export type RatingMatchSet = {
  p1_games: number;
  p2_games: number;
  tiebreak_p1?: number | null;
  tiebreak_p2?: number | null;
};

export type RatingMatchRow = {
  id: string;
  played_at: string;
  is_p1: boolean;
  is_doubles: boolean;
  my_partner_name: string | null;
  opponent_partner_name: string | null;
  i_am_winner: boolean | null;
  outcome: "completed" | "cancelled";
  sets: RatingMatchSet[] | null;
  opponent: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    current_elo: number;
  };
  tournament_id: string | null;
  tournament_name: string | null;
  /** null when no rating_history row was attached (e.g. cancelled match). */
  delta: number | null;
  /** new_elo right after this match was applied. null if no Elo change. */
  new_elo: number | null;
};

export type RatingTabPayload = {
  discipline: RatingDiscipline;
  hero: EloHero;
  history: EloPoint[];
  recentMatches: RatingMatchRow[];
  // True when the player still needs to take the onboarding quiz to get a
  // real starting Elo. The rating page uses this to surface a prominent CTA.
  needs_onboarding_quiz: boolean;
};

const HISTORY_LIMIT = 20;
const MATCHES_LIMIT = 30;

export async function loadMyRatingTab(
  discipline: RatingDiscipline = "singles",
): Promise<RatingTabPayload | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isDoubles = discipline === "doubles";

  const [profileRes, historyRes, matchesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "current_elo, elo_status, rated_matches_count, " +
          "current_elo_doubles, elo_status_doubles, rated_matches_count_doubles, " +
          "onboarding_completed_at",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("rating_history")
      .select("id, created_at, old_elo, new_elo, delta, k_factor, multiplier, reason, match_id")
      .eq("player_id", user.id)
      .eq("discipline", discipline)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("matches")
      .select(
        "id, p1_id, p2_id, p1_partner_id, p2_partner_id, is_doubles, outcome, sets, " +
          "winner_side, played_at, created_at, tournament_id",
      )
      .or(
        `p1_id.eq.${user.id},p2_id.eq.${user.id},` +
          `p1_partner_id.eq.${user.id},p2_partner_id.eq.${user.id}`,
      )
      .eq("is_doubles", isDoubles)
      .in("outcome", ["completed", "cancelled"])
      .order("played_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(MATCHES_LIMIT),
  ]);

  const rawProfile = (profileRes.data as {
    current_elo: number;
    elo_status: "provisional" | "established";
    rated_matches_count: number;
    current_elo_doubles: number;
    elo_status_doubles: "provisional" | "established";
    rated_matches_count_doubles: number;
    onboarding_completed_at: string | null;
  } | null) ?? {
    current_elo: 1000,
    elo_status: "provisional" as const,
    rated_matches_count: 0,
    current_elo_doubles: 1000,
    elo_status_doubles: "provisional" as const,
    rated_matches_count_doubles: 0,
    onboarding_completed_at: null,
  };

  const profile = isDoubles
    ? {
        current_elo: rawProfile.current_elo_doubles,
        elo_status: rawProfile.elo_status_doubles,
        rated_matches_count: rawProfile.rated_matches_count_doubles,
      }
    : {
        current_elo: rawProfile.current_elo,
        elo_status: rawProfile.elo_status,
        rated_matches_count: rawProfile.rated_matches_count,
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

  // -- Build the "recent matches with Elo delta" list --------------------
  const matchRows = (matchesRes.data ?? []) as Array<{
    id: string;
    p1_id: string;
    p2_id: string;
    p1_partner_id: string | null;
    p2_partner_id: string | null;
    is_doubles: boolean;
    outcome: "completed" | "cancelled";
    sets: RatingMatchSet[] | null;
    winner_side: "p1" | "p2" | null;
    played_at: string | null;
    created_at: string;
    tournament_id: string | null;
  }>;

  const sideOf = (m: (typeof matchRows)[number]) =>
    m.p1_id === user.id || m.p1_partner_id === user.id ? "p1" : "p2";

  // Everyone but the viewer — opposing captain plus (for doubles) both
  // partner slots and possibly the viewer's own captain.
  const opponentIds = Array.from(
    new Set(
      matchRows
        .flatMap((m) => [m.p1_id, m.p2_id, m.p1_partner_id, m.p2_partner_id])
        .filter((x): x is string => x != null && x !== user.id),
    ),
  );

  const opponentById = new Map<string, RatingMatchRow["opponent"]>();
  if (opponentIds.length > 0) {
    const { data } = (await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, current_elo, current_elo_doubles")
      .in("id", opponentIds)) as {
      data: Array<
        RatingMatchRow["opponent"] & { current_elo_doubles: number }
      > | null;
    };
    for (const p of data ?? []) {
      opponentById.set(p.id, {
        id: p.id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        // Show the opponent's rating on the SAME ladder as the tab.
        current_elo: isDoubles ? p.current_elo_doubles : p.current_elo,
      });
    }
  }

  const tournamentIds = Array.from(
    new Set(matchRows.map((m) => m.tournament_id).filter((x): x is string => x != null)),
  );
  const tournamentNameById = new Map<string, string>();
  if (tournamentIds.length > 0) {
    const { data } = (await supabase
      .from("tournaments")
      .select("id, name")
      .in("id", tournamentIds)) as {
      data: Array<{ id: string; name: string }> | null;
    };
    for (const t of data ?? []) tournamentNameById.set(t.id, t.name);
  }

  // Pull rating_history rows for this player keyed by match_id so we can
  // attach the actual Elo delta to each match card.
  const matchIds = matchRows.map((m) => m.id);
  const eloByMatch = new Map<string, { delta: number; new_elo: number }>();
  if (matchIds.length > 0) {
    const { data } = (await supabase
      .from("rating_history")
      .select("match_id, delta, new_elo, created_at")
      .eq("player_id", user.id)
      .eq("reason", "match")
      .eq("discipline", discipline)
      .in("match_id", matchIds)
      .order("created_at", { ascending: false })) as {
      data: Array<{
        match_id: string | null;
        delta: number;
        new_elo: number;
        created_at: string;
      }> | null;
    };
    // If there are duplicates (shouldn't be, but defensively), keep the
    // most recent one — the query returns newest first so first wins.
    for (const r of data ?? []) {
      if (!r.match_id || eloByMatch.has(r.match_id)) continue;
      eloByMatch.set(r.match_id, { delta: r.delta, new_elo: r.new_elo });
    }
  }

  const recentMatches: RatingMatchRow[] = matchRows.flatMap((m) => {
    const side = sideOf(m);
    const isP1 = side === "p1";
    const otherId = isP1 ? m.p2_id : m.p1_id;
    const opponent = opponentById.get(otherId);
    if (!opponent) return [];
    const mySideIds = isP1 ? [m.p1_id, m.p1_partner_id] : [m.p2_id, m.p2_partner_id];
    const myPartnerId = mySideIds.find((x) => x != null && x !== user.id) ?? null;
    const opponentPartnerId = isP1 ? m.p2_partner_id : m.p1_partner_id;
    const iAmWinner =
      m.winner_side == null ? null : (m.winner_side === "p1") === isP1 ? true : false;
    const elo = eloByMatch.get(m.id);
    return [
      {
        id: m.id,
        played_at: m.played_at ?? m.created_at,
        is_p1: isP1,
        is_doubles: m.is_doubles,
        my_partner_name: myPartnerId
          ? (opponentById.get(myPartnerId)?.display_name ?? null)
          : null,
        opponent_partner_name: opponentPartnerId
          ? (opponentById.get(opponentPartnerId)?.display_name ?? null)
          : null,
        i_am_winner: iAmWinner,
        outcome: m.outcome,
        sets: m.sets,
        opponent,
        tournament_id: m.tournament_id,
        tournament_name: m.tournament_id ? (tournamentNameById.get(m.tournament_id) ?? null) : null,
        delta: elo?.delta ?? null,
        new_elo: elo?.new_elo ?? null,
      },
    ];
  });

  return {
    discipline,
    hero,
    history,
    recentMatches,
    needs_onboarding_quiz: !rawProfile.onboarding_completed_at,
  };
}
