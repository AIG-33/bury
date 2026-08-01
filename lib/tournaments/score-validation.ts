// =============================================================================
// Server-side validation of a submitted score. Pure + framework-free so it's
// trivially unit-tested.
//
// Deliberately LOOSE: real-world amateur formats vary too much for the server
// to police game counts (tiebreaks to 7 or 10, short sets, timed sets, "next
// game wins" endings…). Any non-negative integer game count is accepted; the
// ONLY requirement for a "completed" match is that a winner is determinable
// from the sets (one side won strictly more sets than the other). Special
// outcomes (walkover / retired / DSQ) skip validation entirely — their score
// is whatever was played before the stoppage.
//
// Used by setMatchScore (organized/actions.ts) for outcome="completed" only.
// =============================================================================

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
 * Count sets won by each side. A tied set (6-6 cut short, 0-0 leftovers…)
 * counts for nobody — only strictly-won sets decide the match.
 */
export function countSetWins(sets: ScoreSetInput[]): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  for (const s of sets) {
    if (s.p1 > s.p2) p1++;
    else if (s.p2 > s.p1) p2++;
  }
  return { p1, p2 };
}

/**
 * Loose validation of a "completed" score: at least one set, and the winner
 * must be determinable (unequal set wins). Nothing else is checked — game
 * counts are free-form by design.
 */
export function validateScoreLoose(sets: ScoreSetInput[]): ScoreValidationResult {
  if (sets.length === 0) return fail("score_too_few_sets");
  const wins = countSetWins(sets);
  if (wins.p1 === wins.p2) return fail("tied_score");
  return ok;
}
