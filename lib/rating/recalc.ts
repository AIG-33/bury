// =============================================================================
// Server-side Elo recalculation for a single match.
//
// Called from setMatchScore (tournaments/actions.ts) and from the friendly
// confirm flow — any place a match transitions to a "decided" outcome.
//
// Disciplines:
//   – Singles (is_doubles = false) rates two players on the SINGLES ladder
//     (profiles.current_elo).
//   – Doubles (is_doubles = true, both partner columns set) rates FOUR
//     players on the DOUBLES ladder (profiles.current_elo_doubles). Team
//     strength = average of the two members; each player keeps their own
//     K-factor.
//
// Idempotent: if rating_history already has a row for this match, we skip.
// That makes it safe to call multiple times during testing or after a re-edit
// (we'd need an explicit "revert + recalc" path to change a previously-rated
// match — handled in a later iteration).
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeDoublesMatchEloDelta,
  computeMatchEloDelta,
  eloStatusFor,
  type MatchKind,
} from "./elo";
import { loadActiveRatingConfig } from "./config";

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
  | {
      ok: true;
      skipped: false;
      p1Delta: number;
      p2Delta: number;
      /** Per-player deltas, keyed by profile id (2 entries for singles, 4 for doubles). */
      deltas: Record<string, number>;
    }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

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

type ProfileRow = {
  id: string;
  current_elo: number;
  rated_matches_count: number;
  current_elo_doubles: number;
  rated_matches_count_doubles: number;
};

/**
 * Decide which `MatchKind` to use for the multiplier.
 *   – No tournament_id           → "friendly".
 *   – Last round of bracket      → "tournament_final".
 *   – Otherwise                  → "tournament".
 */
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

export async function recalcMatchElo(
  supabase: AnySupabase,
  matchId: string,
): Promise<RecalcResult> {
  // 1. Load the match.
  const { data: match, error: mErr } = (await supabase
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
  if (!match.winner_side) {
    return { ok: true, skipped: true, reason: "no_winner_side" };
  }
  if (!match.p2_id) {
    // E.g. an auto-bye walkover (p2 = null). Nothing to rate.
    return { ok: true, skipped: true, reason: "no_opponent" };
  }
  if (match.is_doubles && (!match.p1_partner_id || !match.p2_partner_id)) {
    // A doubles match without both partners cannot be rated fairly.
    return { ok: true, skipped: true, reason: "missing_partner" };
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

  const cfg = await loadActiveRatingConfig(supabase);
  const kind = await classifyKind(supabase, match);
  const ts = match.played_at ?? new Date().toISOString();

  const participantIds = match.is_doubles
    ? [match.p1_id, match.p1_partner_id!, match.p2_id, match.p2_partner_id!]
    : [match.p1_id, match.p2_id];

  // 3. Load all profiles involved.
  const { data: profiles } = (await supabase
    .from("profiles")
    .select(
      "id, current_elo, rated_matches_count, current_elo_doubles, rated_matches_count_doubles",
    )
    .in("id", participantIds)) as { data: ProfileRow[] | null };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p] as const));
  if (participantIds.some((id) => !byId.has(id))) {
    return { ok: false, error: "profile_not_found" };
  }

  // 4. Compute per-player updates for the right ladder.
  type PlayerWrite = {
    id: string;
    oldElo: number;
    newElo: number;
    newCount: number;
    delta: number;
    k: number;
  };
  let writes: PlayerWrite[];
  let multiplier: number;

  if (match.is_doubles) {
    const [t1a, t1b, t2a, t2b] = participantIds.map((id) => byId.get(id)!);
    const update = computeDoublesMatchEloDelta({
      team1: [
        { elo: t1a.current_elo_doubles, matches: t1a.rated_matches_count_doubles },
        { elo: t1b.current_elo_doubles, matches: t1b.rated_matches_count_doubles },
      ],
      team2: [
        { elo: t2a.current_elo_doubles, matches: t2a.rated_matches_count_doubles },
        { elo: t2b.current_elo_doubles, matches: t2b.rated_matches_count_doubles },
      ],
      winnerSide: match.winner_side,
      kind,
      cfg,
    });
    multiplier = update.multiplier;
    const flat = [...update.team1, ...update.team2];
    writes = participantIds.map((id, i) => {
      const p = byId.get(id)!;
      return {
        id,
        oldElo: p.current_elo_doubles,
        newElo: flat[i].newElo,
        newCount: p.rated_matches_count_doubles + 1,
        delta: flat[i].delta,
        k: flat[i].k,
      };
    });
  } else {
    const p1 = byId.get(match.p1_id)!;
    const p2 = byId.get(match.p2_id)!;
    const update = computeMatchEloDelta({
      p1Elo: p1.current_elo,
      p2Elo: p2.current_elo,
      p1Matches: p1.rated_matches_count,
      p2Matches: p2.rated_matches_count,
      winnerSide: match.winner_side,
      kind,
      cfg,
    });
    multiplier = update.multiplier;
    writes = [
      {
        id: p1.id,
        oldElo: p1.current_elo,
        newElo: update.p1NewElo,
        newCount: p1.rated_matches_count + 1,
        delta: update.p1Delta,
        k: update.k1,
      },
      {
        id: p2.id,
        oldElo: p2.current_elo,
        newElo: update.p2NewElo,
        newCount: p2.rated_matches_count + 1,
        delta: update.p2Delta,
        k: update.k2,
      },
    ];
  }

  // 5. Persist. Sequential writes; the idempotency guard above makes retries
  //    after a partial failure safe.
  const discipline = match.is_doubles ? "doubles" : "singles";
  for (const w of writes) {
    const patch = match.is_doubles
      ? {
          current_elo_doubles: w.newElo,
          rated_matches_count_doubles: w.newCount,
          elo_status_doubles: eloStatusFor(w.newCount, cfg),
        }
      : {
          current_elo: w.newElo,
          rated_matches_count: w.newCount,
          elo_status: eloStatusFor(w.newCount, cfg),
        };
    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", w.id);
    if (error) return { ok: false, error: error.message };
  }

  const { error: histErr } = await supabase.from("rating_history").insert(
    writes.map((w) => ({
      player_id: w.id,
      match_id: match.id,
      old_elo: w.oldElo,
      new_elo: w.newElo,
      k_factor: w.k,
      multiplier,
      reason: "match",
      discipline,
      created_at: ts,
    })) as never,
  );
  if (histErr) return { ok: false, error: histErr.message };

  // 6. Update the match row with the multiplier actually used (audit).
  await supabase
    .from("matches")
    .update({ multiplier } as never)
    .eq("id", match.id);

  const deltas: Record<string, number> = {};
  for (const w of writes) deltas[w.id] = w.delta;

  return {
    ok: true,
    skipped: false,
    p1Delta: deltas[match.p1_id],
    p2Delta: deltas[match.p2_id],
    deltas,
  };
}
