// =============================================================================
// Elo revert for a single already-rated match.
//
// Counterpart of lib/rating/recalc.ts (global ladder) and
// lib/rating/club-recalc.ts (club ladders). Used when the organizer resets a
// match result or changes a score in a way that flips the winner: the deltas
// recorded in rating_history / club_rating_history for this match are applied
// in reverse and the history rows are deleted, so a subsequent recalc can
// rate the corrected result from a clean slate.
//
// LIMITATION (deliberate): this is a direct delta rollback, not a cascading
// re-simulation. Matches rated AFTER this one keep the deltas they were
// computed with (K-factor / expected score used the then-current Elo). For
// same-day organizer corrections the error is negligible; a full history
// rebuild stays an admin-side operation.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { eloStatusFor, type RatingConfig } from "./elo";
import { loadActiveRatingConfig } from "./config";
import { clubRatingConfigFromRow, clubRatingConfigToRatingConfig } from "@/lib/clubs/rating-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export type RevertResult =
  | { ok: true; skipped: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

// ─── Pure planning (unit-tested) ─────────────────────────────────────────────

export type EloHistoryRow = {
  player_id: string;
  old_elo: number;
  new_elo: number;
  discipline: "singles" | "doubles";
};

export type RevertProfileState = {
  id: string;
  current_elo: number;
  rated_matches_count: number;
  current_elo_doubles: number;
  rated_matches_count_doubles: number;
};

export type ProfileRevertWrite = {
  id: string;
  discipline: "singles" | "doubles";
  newElo: number;
  newCount: number;
  newStatus: "provisional" | "established";
};

/**
 * Undo the per-player deltas of one match on the CURRENT profile values.
 * `newElo = current - (new_elo - old_elo)`: later matches may have moved the
 * rating further, so we subtract this match's delta instead of restoring the
 * absolute pre-match value.
 */
export function planEloRevert(
  history: EloHistoryRow[],
  profiles: RevertProfileState[],
  cfg: RatingConfig,
): ProfileRevertWrite[] | null {
  const byId = new Map(profiles.map((p) => [p.id, p] as const));
  const writes: ProfileRevertWrite[] = [];
  for (const row of history) {
    const p = byId.get(row.player_id);
    if (!p) return null;
    const delta = row.new_elo - row.old_elo;
    const isDoubles = row.discipline === "doubles";
    const currentElo = isDoubles ? p.current_elo_doubles : p.current_elo;
    const currentCount = isDoubles ? p.rated_matches_count_doubles : p.rated_matches_count;
    const newCount = Math.max(0, currentCount - 1);
    writes.push({
      id: row.player_id,
      discipline: row.discipline,
      newElo: currentElo - delta,
      newCount,
      newStatus: eloStatusFor(newCount, cfg),
    });
  }
  return writes;
}

// ─── Global ladder ────────────────────────────────────────────────────────────

/**
 * Roll back the global Elo applied for `matchId` and delete its
 * rating_history rows. Requires the service-role client (profiles Elo and
 * rating_history are service-only by RLS). Safe to call when the match was
 * never rated — returns `{ skipped: true }`.
 */
export async function revertMatchElo(service: AnySupabase, matchId: string): Promise<RevertResult> {
  const { data: history, error: hErr } = (await service
    .from("rating_history")
    .select("player_id, old_elo, new_elo, discipline")
    .eq("match_id", matchId)
    .eq("reason", "match")) as {
    data: EloHistoryRow[] | null;
    error: { message: string } | null;
  };
  if (hErr) return { ok: false, error: hErr.message };
  if (!history || history.length === 0) {
    return { ok: true, skipped: true, reason: "not_rated" };
  }

  const playerIds = history.map((h) => h.player_id);
  const { data: profiles } = (await service
    .from("profiles")
    .select(
      "id, current_elo, rated_matches_count, current_elo_doubles, rated_matches_count_doubles",
    )
    .in("id", playerIds)) as { data: RevertProfileState[] | null };

  const cfg = await loadActiveRatingConfig(service);
  const writes = planEloRevert(history, profiles ?? [], cfg);
  if (!writes) return { ok: false, error: "profile_not_found" };

  for (const w of writes) {
    const patch =
      w.discipline === "doubles"
        ? {
            current_elo_doubles: w.newElo,
            rated_matches_count_doubles: w.newCount,
            elo_status_doubles: w.newStatus,
          }
        : {
            current_elo: w.newElo,
            rated_matches_count: w.newCount,
            elo_status: w.newStatus,
          };
    const { error } = await service
      .from("profiles")
      .update(patch as never)
      .eq("id", w.id);
    if (error) return { ok: false, error: error.message };
  }

  // History rows go last: if a profile write failed mid-way, the remaining
  // rows keep the revert retryable (deltas already reverted would double-
  // revert only if the caller retries after a partial failure — acceptable
  // for an organizer-triggered fix, and failures here are exotic).
  const { error: delErr } = await service
    .from("rating_history")
    .delete()
    .eq("match_id", matchId)
    .eq("reason", "match");
  if (delErr) return { ok: false, error: delErr.message };

  // matches.multiplier is NOT NULL (default 1.0) — restore the default; the
  // next recalcMatchElo overwrites it with the multiplier actually used.
  await service
    .from("matches")
    .update({ multiplier: 1.0 } as never)
    .eq("id", matchId);

  return { ok: true, skipped: false };
}

// ─── Club ladders ─────────────────────────────────────────────────────────────

type ClubHistoryRow = {
  club_id: string;
  player_id: string;
  old_rating: number;
  new_rating: number;
  discipline: "singles" | "doubles";
};

/**
 * Roll back every club rating this match fed (wins/losses counters included)
 * and delete the club_rating_history rows. Must run BEFORE the match row's
 * winner_side is overwritten — the old winner decides whose `wins` counter
 * is decremented.
 */
export async function revertClubRatingsForMatch(
  service: AnySupabase,
  matchId: string,
): Promise<RevertResult> {
  const { data: history, error: hErr } = (await service
    .from("club_rating_history")
    .select("club_id, player_id, old_rating, new_rating, discipline")
    .eq("match_id", matchId)
    .eq("reason", "match")) as {
    data: ClubHistoryRow[] | null;
    error: { message: string } | null;
  };
  if (hErr) return { ok: false, error: hErr.message };
  if (!history || history.length === 0) {
    return { ok: true, skipped: true, reason: "not_rated" };
  }

  const { data: match } = (await service
    .from("matches")
    .select("p1_id, p1_partner_id, winner_side")
    .eq("id", matchId)
    .maybeSingle()) as {
    data: {
      p1_id: string;
      p1_partner_id: string | null;
      winner_side: "p1" | "p2" | null;
    } | null;
  };
  const side1 = new Set([match?.p1_id, match?.p1_partner_id].filter(Boolean) as string[]);

  const clubIds = [...new Set(history.map((h) => h.club_id))];
  const cfgByClub = new Map<string, RatingConfig>();
  for (const clubId of clubIds) {
    const { data: settings } = (await service
      .from("club_rating_settings")
      .select("config")
      .eq("club_id", clubId)
      .maybeSingle()) as { data: { config: unknown } | null };
    cfgByClub.set(
      clubId,
      clubRatingConfigToRatingConfig(clubRatingConfigFromRow(settings?.config)),
    );
  }

  for (const row of history) {
    const { data: rating } = (await service
      .from("club_member_ratings")
      .select("rating, rated_matches_count, wins, losses")
      .eq("club_id", row.club_id)
      .eq("player_id", row.player_id)
      .eq("discipline", row.discipline)
      .maybeSingle()) as {
      data: {
        rating: number;
        rated_matches_count: number;
        wins: number;
        losses: number;
      } | null;
    };
    if (!rating) continue;

    const delta = row.new_rating - row.old_rating;
    const newCount = Math.max(0, rating.rated_matches_count - 1);
    const won =
      match?.winner_side != null && (match.winner_side === "p1") === side1.has(row.player_id);
    const cfg = cfgByClub.get(row.club_id)!;
    const { error } = await service
      .from("club_member_ratings")
      .update({
        rating: rating.rating - delta,
        rated_matches_count: newCount,
        rating_status: eloStatusFor(newCount, cfg),
        wins: Math.max(0, rating.wins - (won ? 1 : 0)),
        losses: Math.max(0, rating.losses - (won ? 0 : 1)),
      } as never)
      .eq("club_id", row.club_id)
      .eq("player_id", row.player_id)
      .eq("discipline", row.discipline);
    if (error) return { ok: false, error: error.message };
  }

  const { error: delErr } = await service
    .from("club_rating_history")
    .delete()
    .eq("match_id", matchId)
    .eq("reason", "match");
  if (delErr) return { ok: false, error: delErr.message };

  return { ok: true, skipped: false };
}
