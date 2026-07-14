// =============================================================================
// Server-side validation of a submitted score against a tournament's
// `match_rules` (JSONB). Pure + framework-free so it's trivially unit-tested.
//
// Used by setMatchScore (organized/actions.ts) for outcome="completed" only —
// special outcomes (walkover / retired / DSQ) carry whatever partial score
// was played and are NOT validated here.
// =============================================================================

import type { MatchRules } from "./schema";

export type ScoreSetInput = {
  p1: number;
  p2: number;
  tb_p1?: number | null;
  tb_p2?: number | null;
};

export type ScoreValidationResult = { ok: true } | { ok: false; error: string };

const ok: ScoreValidationResult = { ok: true };
const fail = (error: string): ScoreValidationResult => ({ ok: false, error });

/**
 * A regular tennis set with games to `target`, tiebreak played at
 * `tiebreakAt`-all. Examples for target=6, tiebreakAt=6:
 * 6-0…6-4, 7-5, 7-6. 6-5 / 8-6 / ties are invalid.
 */
function isValidRegularSet(p1: number, p2: number, target: number, tiebreakAtRaw: number): boolean {
  // A tiebreak can't happen before the target is reachable. Long sets
  // (e.g. set_target=10) created while the form kept the default
  // set_tiebreak_at=6 would otherwise wrongly accept 7-6 and reject 11-10.
  const tiebreakAt = Math.max(tiebreakAtRaw, target);
  const w = Math.max(p1, p2);
  const l = Math.min(p1, p2);
  if (w === l) return false;
  // Straight win: reached the target with a margin of 2+.
  if (w === target && l <= target - 2) return true;
  // Extended set: win by exactly 2 past the target, until the tiebreak score.
  if (w === l + 2 && l >= target - 1 && w <= tiebreakAt + 1) return true;
  // Tiebreak set: e.g. 7-6 for tiebreakAt=6.
  if (w === tiebreakAt + 1 && l === tiebreakAt) return true;
  return false;
}

/**
 * A match (super) tiebreak in lieu of a deciding set. Accepted shapes:
 *   – points recorded directly in p1/p2 (10-8, 11-9, …): first to 10, win by 2;
 *   – "1-0" set with the points in tb_p1/tb_p2.
 */
function isValidSuperTiebreak(s: ScoreSetInput): boolean {
  const w = Math.max(s.p1, s.p2);
  const l = Math.min(s.p1, s.p2);
  if (w >= 10 && w - l >= 2) return true;
  if (w === 1 && l === 0 && s.tb_p1 != null && s.tb_p2 != null) {
    const tw = Math.max(s.tb_p1, s.tb_p2);
    const tl = Math.min(s.tb_p1, s.tb_p2);
    const setWinnerSide = s.p1 > s.p2 ? "p1" : "p2";
    const tbWinnerSide = s.tb_p1 > s.tb_p2 ? "p1" : s.tb_p2 > s.tb_p1 ? "p2" : null;
    return tw >= 10 && tw - tl >= 2 && tbWinnerSide === setWinnerSide;
  }
  return false;
}

function setWinner(s: ScoreSetInput): "p1" | "p2" | null {
  if (s.p1 > s.p2) return "p1";
  if (s.p2 > s.p1) return "p2";
  return null;
}

/**
 * Validate a best-of-N sequence: every set decided, match decided exactly on
 * the last submitted set (no missing and no extra sets).
 */
function validateBestOf(
  sets: ScoreSetInput[],
  setsToWin: number,
  validateSet: (s: ScoreSetInput, index: number, total: number) => ScoreValidationResult,
): ScoreValidationResult {
  const maxSets = setsToWin * 2 - 1;
  if (sets.length < setsToWin) return fail("score_too_few_sets");
  if (sets.length > maxSets) return fail("score_too_many_sets");

  let p1Wins = 0;
  let p2Wins = 0;
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    const w = setWinner(s);
    if (!w) return fail("score_set_tie");
    const r = validateSet(s, i, sets.length);
    if (!r.ok) return r;
    // Match already decided before this set → extra trailing set.
    if (p1Wins >= setsToWin || p2Wins >= setsToWin) return fail("score_extra_sets");
    if (w === "p1") p1Wins++;
    else p2Wins++;
  }
  if (p1Wins < setsToWin && p2Wins < setsToWin) return fail("score_too_few_sets");
  return ok;
}

/**
 * Validate the submitted sets against the tournament's match rules.
 * Returns a stable error code (mapped to a localized message in the UI).
 */
export function validateScoreAgainstRules(
  sets: ScoreSetInput[],
  rules: MatchRules,
): ScoreValidationResult {
  if (sets.length === 0) return fail("score_too_few_sets");

  switch (rules.kind) {
    case "best_of_3":
    case "best_of_5": {
      const setsToWin = rules.kind === "best_of_3" ? 2 : 3;
      const superDecider =
        rules.kind === "best_of_3" && rules.super_tiebreak_decider;
      return validateBestOf(sets, setsToWin, (s, index, total) => {
        const isDecider = index === total - 1 && index === setsToWin * 2 - 2;
        if (superDecider && isDecider) {
          // The organizer score widget can also record the decider as a
          // regular set, so accept both shapes.
          if (
            isValidSuperTiebreak(s) ||
            isValidRegularSet(s.p1, s.p2, rules.set_target, rules.set_tiebreak_at)
          ) {
            return ok;
          }
          return fail("score_invalid_super_tiebreak");
        }
        return isValidRegularSet(s.p1, s.p2, rules.set_target, rules.set_tiebreak_at)
          ? ok
          : fail("score_invalid_set");
      });
    }

    case "single_set": {
      if (sets.length > 1) return fail("score_too_many_sets");
      const s = sets[0];
      if (!setWinner(s)) return fail("score_set_tie");
      return isValidRegularSet(s.p1, s.p2, rules.set_target, rules.set_tiebreak_at)
        ? ok
        : fail("score_invalid_set");
    }

    case "pro_set": {
      if (sets.length > 1) return fail("score_too_many_sets");
      const s = sets[0];
      if (!setWinner(s)) return fail("score_set_tie");
      // Pro-set to N, win by 2, tiebreak at N-all (e.g. 8-0…8-6, 9-7, 9-8).
      return isValidRegularSet(s.p1, s.p2, rules.target_games, rules.target_games)
        ? ok
        : fail("score_invalid_set");
    }

    case "first_to_games": {
      if (sets.length > 1) return fail("score_too_many_sets");
      const s = sets[0];
      const w = Math.max(s.p1, s.p2);
      const l = Math.min(s.p1, s.p2);
      if (!setWinner(s)) return fail("score_set_tie");
      // First to N games wins outright — no two-game margin required.
      return w === rules.target_games && l < rules.target_games
        ? ok
        : fail("score_invalid_set");
    }

    case "timed": {
      // Timed matches stop mid-set, so game counts are free-form. We only
      // require an overall winner (sets won, then total games as the decider
      // recorded by the organizer) — computeWinnerSide handles ties upstream.
      return ok;
    }
  }
}
