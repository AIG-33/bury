// =============================================================================
// Per-club Elo recalculation for a single match.
//
// Mirrors lib/rating/recalc.ts but writes to the club-scoped tables
// (club_member_ratings / club_rating_history) and never touches the global
// profiles Elo columns. A match can feed more than one club's rating, so the
// public entry point is `recalcClubRatingsForMatch`.
//
// Disciplines: like the global rating, every club runs TWO independent
// ladders — singles and doubles. `club_member_ratings` is keyed by
// (club_id, player_id, discipline).
//
// Which clubs a match feeds:
//   – Tournament match → the tournament's club (tournaments.club_id), if set.
//   – Friendly match   → every club where ALL participants (2 for singles,
//                        4 for doubles) are approved members and the club
//                        rating is enabled.
//
// Idempotent per (club, match): a unique index on club_rating_history backs
// the in-code guard, so retries are safe.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeDoublesMatchEloDelta,
  computeMatchEloDelta,
  eloStatusFor,
  type MatchKind,
} from "./elo";
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
  is_doubles: boolean;
  p1_id: string;
  p1_partner_id: string | null;
  p2_id: string | null;
  p2_partner_id: string | null;
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
  match: Pick<MatchRow, "tournament_id" | "round">,
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
  discipline: "singles" | "doubles",
  startRating: number,
): Promise<ClubRatingRow> {
  const { data } = (await service
    .from("club_member_ratings")
    .select("player_id, rating, rated_matches_count, wins, losses")
    .eq("club_id", clubId)
    .eq("player_id", playerId)
    .eq("discipline", discipline)
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
      "id, tournament_id, round, outcome, winner_side, is_doubles, " +
        "p1_id, p1_partner_id, p2_id, p2_partner_id, played_at",
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
  if (match.is_doubles && (!match.p1_partner_id || !match.p2_partner_id)) {
    return { ok: true, skipped: true, reason: "missing_partner" };
  }

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

  const kind = await classifyKind(service, match);
  const discipline: "singles" | "doubles" = match.is_doubles ? "doubles" : "singles";

  const side1Ids = match.is_doubles
    ? [match.p1_id, match.p1_partner_id!]
    : [match.p1_id];
  const side2Ids = match.is_doubles
    ? [match.p2_id, match.p2_partner_id!]
    : [match.p2_id];
  const participantIds = [...side1Ids, ...side2Ids];

  const ratings = new Map<string, ClubRatingRow>();
  for (const id of participantIds) {
    ratings.set(
      id,
      await loadOrSeedRating(service, clubId, id, discipline, clubConfig.start_rating),
    );
  }

  type PlayerWrite = {
    id: string;
    old: ClubRatingRow;
    newRating: number;
    delta: number;
    k: number;
    won: boolean;
  };
  const p1Won = match.winner_side === "p1";
  let writes: PlayerWrite[];
  let multiplier: number;

  if (match.is_doubles) {
    const [t1a, t1b, t2a, t2b] = participantIds.map((id) => ratings.get(id)!);
    const update = computeDoublesMatchEloDelta({
      team1: [
        { elo: t1a.rating, matches: t1a.rated_matches_count },
        { elo: t1b.rating, matches: t1b.rated_matches_count },
      ],
      team2: [
        { elo: t2a.rating, matches: t2a.rated_matches_count },
        { elo: t2b.rating, matches: t2b.rated_matches_count },
      ],
      winnerSide: match.winner_side,
      kind,
      cfg,
    });
    multiplier = update.multiplier;
    const flat = [...update.team1, ...update.team2];
    writes = participantIds.map((id, i) => ({
      id,
      old: ratings.get(id)!,
      newRating: flat[i].newElo,
      delta: flat[i].delta,
      k: flat[i].k,
      won: i < 2 ? p1Won : !p1Won,
    }));
  } else {
    const p1 = ratings.get(match.p1_id)!;
    const p2 = ratings.get(match.p2_id)!;
    const update = computeMatchEloDelta({
      p1Elo: p1.rating,
      p2Elo: p2.rating,
      p1Matches: p1.rated_matches_count,
      p2Matches: p2.rated_matches_count,
      winnerSide: match.winner_side,
      kind,
      cfg,
    });
    multiplier = update.multiplier;
    writes = [
      { id: match.p1_id, old: p1, newRating: update.p1NewElo, delta: update.p1Delta, k: update.k1, won: p1Won },
      { id: match.p2_id, old: p2, newRating: update.p2NewElo, delta: update.p2Delta, k: update.k2, won: !p1Won },
    ];
  }

  const ts = match.played_at ?? new Date().toISOString();

  for (const w of writes) {
    const newCount = w.old.rated_matches_count + 1;
    const { error } = await service.from("club_member_ratings").upsert(
      {
        club_id: clubId,
        player_id: w.id,
        discipline,
        rating: w.newRating,
        rating_status: eloStatusFor(newCount, cfg),
        rated_matches_count: newCount,
        wins: w.old.wins + (w.won ? 1 : 0),
        losses: w.old.losses + (w.won ? 0 : 1),
      } as never,
      { onConflict: "club_id,player_id,discipline" } as never,
    );
    if (error) return { ok: false, error: error.message };
  }

  const { error: histErr } = await service.from("club_rating_history").insert(
    writes.map((w) => ({
      club_id: clubId,
      player_id: w.id,
      match_id: match.id,
      old_rating: w.old.rating,
      new_rating: w.newRating,
      k_factor: w.k,
      multiplier,
      reason: "match",
      discipline,
      created_at: ts,
    })) as never,
  );
  if (histErr) return { ok: false, error: histErr.message };

  const deltaById = new Map(writes.map((w) => [w.id, w.delta] as const));
  return {
    ok: true,
    skipped: false,
    clubId,
    p1Delta: deltaById.get(match.p1_id) ?? 0,
    p2Delta: deltaById.get(match.p2_id) ?? 0,
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
    .select("id, tournament_id, is_doubles, p1_id, p1_partner_id, p2_id, p2_partner_id")
    .eq("id", matchId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          tournament_id: string | null;
          is_doubles: boolean;
          p1_id: string;
          p1_partner_id: string | null;
          p2_id: string | null;
          p2_partner_id: string | null;
        }
      | null;
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
    // Friendly: every club where ALL participants are approved members.
    const participantIds = match.is_doubles
      ? [match.p1_id, match.p1_partner_id, match.p2_id, match.p2_partner_id].filter(
          (x): x is string => x != null,
        )
      : [match.p1_id, match.p2_id];
    if (match.is_doubles && participantIds.length !== 4) return [];

    const memberSets = await Promise.all(
      participantIds.map((id) => approvedMemberClubIds(service, id)),
    );
    const [first, ...rest] = memberSets;
    for (const id of first ?? new Set<string>()) {
      if (rest.every((s) => s.has(id))) clubIds.add(id);
    }
  }

  const results: ClubRecalcResult[] = [];
  for (const clubId of clubIds) {
    results.push(await recalcClubMatchElo(service, clubId, matchId));
  }
  return results;
}
