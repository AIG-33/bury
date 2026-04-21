// =============================================================================
// Server-side Elo recalculation for a single match.
//
// Called from setMatchScore (tournaments/actions.ts) and — eventually — from
// any place a match transitions to a "decided" outcome.
//
// Idempotent: if rating_history already has a row for this match, we skip.
// That makes it safe to call multiple times during testing or after a re-edit
// (we'd need an explicit "revert + recalc" path to change a previously-rated
// match — handled in a later iteration).
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeMatchEloDelta,
  eloStatusFor,
  type MatchKind,
} from "./elo";

// We deliberately keep the type loose; the call-sites already use the typed
// Database client and we don't want a cyclic dep on the Database type here.
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

export type RecalcResult =
  | { ok: true; skipped: false; p1Delta: number; p2Delta: number }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

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

type ProfileRow = {
  id: string;
  current_elo: number;
  rated_matches_count: number;
};

/**
 * Decide which `MatchKind` to use for the multiplier.
 *   – No tournament_id           → "friendly".
 *   – Last round of bracket      → "tournament_final".
 *   – Otherwise                  → "tournament".
 */
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

export async function recalcMatchElo(
  supabase: AnySupabase,
  matchId: string,
): Promise<RecalcResult> {
  // 1. Load the match.
  const { data: match, error: mErr } = (await supabase
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
  if (!match.winner_side) {
    return { ok: true, skipped: true, reason: "no_winner_side" };
  }
  if (!match.p2_id) {
    // E.g. an auto-bye walkover (p2 = null). Nothing to rate.
    return { ok: true, skipped: true, reason: "no_opponent" };
  }

  // 2. Idempotency guard.
  const { data: existing } = (await supabase
    .from("rating_history")
    .select("id")
    .eq("match_id", matchId)
    .limit(1)) as { data: Array<{ id: string }> | null };
  if (existing && existing.length > 0) {
    return { ok: true, skipped: true, reason: "already_rated" };
  }

  // 3. Load both profiles.
  const { data: profiles } = (await supabase
    .from("profiles")
    .select("id, current_elo, rated_matches_count")
    .in("id", [match.p1_id, match.p2_id])) as {
    data: ProfileRow[] | null;
  };
  const p1 = (profiles ?? []).find((p) => p.id === match.p1_id);
  const p2 = (profiles ?? []).find((p) => p.id === match.p2_id);
  if (!p1 || !p2) return { ok: false, error: "profile_not_found" };

  // 4. Compute the update.
  const kind = await classifyKind(supabase, match);
  const update = computeMatchEloDelta({
    p1Elo: p1.current_elo,
    p2Elo: p2.current_elo,
    p1Matches: p1.rated_matches_count,
    p2Matches: p2.rated_matches_count,
    winnerSide: match.winner_side,
    kind,
  });

  const ts = match.played_at ?? new Date().toISOString();

  // 5. Persist atomically-as-possible. We do four writes in sequence:
  //    – update p1 profile
  //    – update p2 profile
  //    – insert two rating_history rows
  //    Postgres transaction would be nicer; in MVP we tolerate the rare
  //    partial-failure (caller may retry; idempotency guard above covers it).
  const newP1Matches = p1.rated_matches_count + 1;
  const newP2Matches = p2.rated_matches_count + 1;

  const { error: p1Err } = await supabase
    .from("profiles")
    .update({
      current_elo: update.p1NewElo,
      rated_matches_count: newP1Matches,
      elo_status: eloStatusFor(newP1Matches),
    } as never)
    .eq("id", p1.id);
  if (p1Err) return { ok: false, error: p1Err.message };

  const { error: p2Err } = await supabase
    .from("profiles")
    .update({
      current_elo: update.p2NewElo,
      rated_matches_count: newP2Matches,
      elo_status: eloStatusFor(newP2Matches),
    } as never)
    .eq("id", p2.id);
  if (p2Err) return { ok: false, error: p2Err.message };

  const { error: histErr } = await supabase.from("rating_history").insert([
    {
      player_id: p1.id,
      match_id: match.id,
      old_elo: p1.current_elo,
      new_elo: update.p1NewElo,
      k_factor: update.k1,
      multiplier: update.multiplier,
      reason: "match",
      created_at: ts,
    },
    {
      player_id: p2.id,
      match_id: match.id,
      old_elo: p2.current_elo,
      new_elo: update.p2NewElo,
      k_factor: update.k2,
      multiplier: update.multiplier,
      reason: "match",
      created_at: ts,
    },
  ] as never);
  if (histErr) return { ok: false, error: histErr.message };

  // 6. Update the match row with the multiplier actually used (audit).
  await supabase
    .from("matches")
    .update({ multiplier: update.multiplier } as never)
    .eq("id", match.id);

  return {
    ok: true,
    skipped: false,
    p1Delta: update.p1Delta,
    p2Delta: update.p2Delta,
  };
}
