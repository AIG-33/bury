// =============================================================================
// Pure helpers for tennis score handling.
//
// Kept side-effect-free so they can be reused on the server (in actions) and
// the client (live preview), and unit-tested without mocking Supabase.
// =============================================================================

export type SetScore = {
  p1_games: number;
  p2_games: number;
  tiebreak_p1?: number | null;
  tiebreak_p2?: number | null;
};

export type WinnerSide = "p1" | "p2";

/**
 * Infer the winner from a list of sets. We follow the simplest rule: count
 * sets won by each side. Tie-break scores are used only as a tie-breaker
 * inside an individual set when games are equal (e.g. 7-7 with TB 8-6).
 *
 * Returns null when the score is incomplete or perfectly tied.
 */
export function inferWinnerFromSets(sets: SetScore[]): WinnerSide | null {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  let p1Sets = 0;
  let p2Sets = 0;
  for (const s of sets) {
    if (s.p1_games > s.p2_games) {
      p1Sets += 1;
    } else if (s.p2_games > s.p1_games) {
      p2Sets += 1;
    } else if (
      s.tiebreak_p1 != null &&
      s.tiebreak_p2 != null &&
      s.tiebreak_p1 !== s.tiebreak_p2
    ) {
      if (s.tiebreak_p1 > s.tiebreak_p2) p1Sets += 1;
      else p2Sets += 1;
    }
  }
  if (p1Sets > p2Sets) return "p1";
  if (p2Sets > p1Sets) return "p2";
  return null;
}

/**
 * True when at least one set has a non-zero number of games played for either
 * side. Used to filter "empty" rows out of forms before validation.
 */
export function hasAnyGames(sets: SetScore[]): boolean {
  return sets.some((s) => (s.p1_games ?? 0) + (s.p2_games ?? 0) > 0);
}
