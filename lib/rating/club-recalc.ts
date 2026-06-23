// =============================================================================
// Per-club Elo recalculation for a single match.
//
// Mirrors lib/rating/recalc.ts but writes to the club-scoped tables
// (club_member_ratings / club_rating_history) and never touches the global
// profiles.current_elo. A match can feed more than one club's rating, so the
// public entry point is `recalcClubRatingsForMatch`.
//
// Which clubs a match feeds:
//   – Tournament match → the tournament's club (tournaments.club_id), if set.
//   – Friendly match   → every club where BOTH players are approved members
//                        and the club rating is enabled.
//
// Idempotent per (club, match): a unique index on club_rating_history backs
// the in-code guard, so retries are safe.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMatchEloDelta, eloStatusFor, type MatchKind } from "./elo";
import {
  clubRatingConfigFromRow,
  clubRatingConfigToRatingConfig,
} from "@/lib/clubs/rating-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

const FINISHED_OUTCOMES = new Set([
  "completed",
  "walkover_p1",
  "walkover_p2",
  "retired_p1",
  "retired_p2",
  "dsq_p1",
  "dsq_p2",
]);

type MatchRow = {
  id: string;
  tournament_id: string | null;
  round: number | null;
  outcome: string;
  winner_side: "p1" | "p2" | null;
  p1_id: string;
  p2_id: string | null;
  played_at: string | null;
};

type ClubRatingRow = {
  player_id: string;
  rating: number;
  rated_matches_count: number;
  wins: number;
  losses: number;
};

export type ClubRecalcResult =
  | { ok: true; skipped: false; clubId: string; p1Delta: number; p2Delta: number }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

async function classifyKind(
  supabase: AnySupabase,
  match: MatchRow,
): Promise<MatchKind> {
  if (match.tournament_id == null) return "friendly";
  if (match.round == null) return "tournament";
  const { data: maxRow } = (await supabase
    .from("matches")
    .select("round")
    .eq("tournament_id", match.tournament_id)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { round: number | null } | null };
  return maxRow?.round === match.round ? "tournament_final" : "tournament";
}

async function loadOrSeedRating(
  service: AnySupabase,
  clubId: string,
  playerId: string,
  startRating: number,
): Promise<ClubRatingRow> {
  const { data } = (await service
    .from("club_member_ratings")
    .select("player_id, rating, rated_matches_count, wins, losses")
    .eq("club_id", clubId)
    .eq("player_id", playerId)
    .maybeSingle()) as { data: ClubRatingRow | null };
  return (
    data ?? {
      player_id: playerId,
      rating: startRating,
      rated_matches_count: 0,
      wins: 0,
      losses: 0,
    }
  );
}

/**
 * Recalculate one club's rating for one match. Service-role client required
 * (writes bypass RLS). Assumes the caller decided this match feeds this club.
 */
export async function recalcClubMatchElo(
  service: AnySupabase,
  clubId: string,
  matchId: string,
): Promise<ClubRecalcResult> {
  const { data: settings } = (await service
    .from("club_rating_settings")
    .select("enabled, config")
    .eq("club_id", clubId)
    .maybeSingle()) as {
    data: { enabled: boolean; config: unknown } | null;
  };
  // No row yet → treat as enabled with default config (lazy bootstrap).
  if (settings && settings.enabled === false) {
    return { ok: true, skipped: true, reason: "rating_disabled" };
  }
  const clubConfig = clubRatingConfigFromRow(settings?.config);
  const cfg = clubRatingConfigToRatingConfig(clubConfig);

  const { data: match, error: mErr } = (await service
    .from("matches")
    .select(
      "id, tournament_id, round, outcome, winner_side, p1_id, p2_id, played_at",
    )
    .eq("id", matchId)
    .maybeSingle()) as {
    data: MatchRow | null;
    error: { message: string } | null;
  };
  if (mErr) return { ok: false, error: mErr.message };
  if (!match) return { ok: false, error: "match_not_found" };
  if (!FINISHED_OUTCOMES.has(match.outcome)) {
    return { ok: true, skipped: true, reason: "not_finished" };
  }
  if (!match.winner_side) return { ok: true, skipped: true, reason: "no_winner_side" };
  if (!match.p2_id) return { ok: true, skipped: true, reason: "no_opponent" };

  // Idempotency guard (DB unique index backs this).
  const { data: existing } = (await service
    .from("club_rating_history")
    .select("id")
    .eq("club_id", clubId)
    .eq("match_id", matchId)
    .limit(1)) as { data: Array<{ id: string }> | null };
  if (existing && existing.length > 0) {
    return { ok: true, skipped: true, reason: "already_rated" };
  }

  const p1 = await loadOrSeedRating(service, clubId, match.p1_id, clubConfig.start_rating);
  const p2 = await loadOrSeedRating(service, clubId, match.p2_id, clubConfig.start_rating);

  const kind = await classifyKind(service, match);
  const update = computeMatchEloDelta({
    p1Elo: p1.rating,
    p2Elo: p2.rating,
    p1Matches: p1.rated_matches_count,
    p2Matches: p2.rated_matches_count,
    winnerSide: match.winner_side,
    kind,
    cfg,
  });

  const ts = match.played_at ?? new Date().toISOString();
  const p1Won = match.winner_side === "p1";
  const newP1Count = p1.rated_matches_count + 1;
  const newP2Count = p2.rated_matches_count + 1;

  const { error: up1 } = await service.from("club_member_ratings").upsert(
    {
      club_id: clubId,
      player_id: p1.player_id,
      rating: update.p1NewElo,
      rating_status: eloStatusFor(newP1Count, cfg),
      rated_matches_count: newP1Count,
      wins: p1.wins + (p1Won ? 1 : 0),
      losses: p1.losses + (p1Won ? 0 : 1),
    } as never,
    { onConflict: "club_id,player_id" } as never,
  );
  if (up1) return { ok: false, error: up1.message };

  const { error: up2 } = await service.from("club_member_ratings").upsert(
    {
      club_id: clubId,
      player_id: p2.player_id,
      rating: update.p2NewElo,
      rating_status: eloStatusFor(newP2Count, cfg),
      rated_matches_count: newP2Count,
      wins: p2.wins + (p1Won ? 0 : 1),
      losses: p2.losses + (p1Won ? 1 : 0),
    } as never,
    { onConflict: "club_id,player_id" } as never,
  );
  if (up2) return { ok: false, error: up2.message };

  const { error: histErr } = await service.from("club_rating_history").insert([
    {
      club_id: clubId,
      player_id: p1.player_id,
      match_id: match.id,
      old_rating: p1.rating,
      new_rating: update.p1NewElo,
      k_factor: update.k1,
      multiplier: update.multiplier,
      reason: "match",
      created_at: ts,
    },
    {
      club_id: clubId,
      player_id: p2.player_id,
      match_id: match.id,
      old_rating: p2.rating,
      new_rating: update.p2NewElo,
      k_factor: update.k2,
      multiplier: update.multiplier,
      reason: "match",
      created_at: ts,
    },
  ] as never);
  if (histErr) return { ok: false, error: histErr.message };

  return {
    ok: true,
    skipped: false,
    clubId,
    p1Delta: update.p1Delta,
    p2Delta: update.p2Delta,
  };
}

async function approvedMemberClubIds(
  service: AnySupabase,
  playerId: string,
): Promise<Set<string>> {
  const { data } = (await service
    .from("club_members")
    .select("club_id")
    .eq("user_id", playerId)
    .eq("status", "approved")) as { data: Array<{ club_id: string }> | null };
  return new Set((data ?? []).map((r) => r.club_id));
}

/**
 * Recalculate every club rating a match feeds. Safe to call after any match is
 * scored/confirmed; no-op for matches that belong to no rating-tracking club.
 */
export async function recalcClubRatingsForMatch(
  service: AnySupabase,
  matchId: string,
): Promise<ClubRecalcResult[]> {
  const { data: match } = (await service
    .from("matches")
    .select("id, tournament_id, p1_id, p2_id")
    .eq("id", matchId)
    .maybeSingle()) as {
    data: { id: string; tournament_id: string | null; p1_id: string; p2_id: string | null } | null;
  };
  if (!match || !match.p2_id) return [];

  const clubIds = new Set<string>();

  if (match.tournament_id) {
    const { data: t } = (await service
      .from("tournaments")
      .select("club_id")
      .eq("id", match.tournament_id)
      .maybeSingle()) as { data: { club_id: string | null } | null };
    if (t?.club_id) clubIds.add(t.club_id);
  } else {
    // Friendly: every club where BOTH players are approved members.
    const [a, b] = await Promise.all([
      approvedMemberClubIds(service, match.p1_id),
      approvedMemberClubIds(service, match.p2_id),
    ]);
    for (const id of a) if (b.has(id)) clubIds.add(id);
  }

  const results: ClubRecalcResult[] = [];
  for (const clubId of clubIds) {
    results.push(await recalcClubMatchElo(service, clubId, matchId));
  }
  return results;
}
