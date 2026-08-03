// =============================================================================
// Pure helpers for DISPLAYING a recorded match score. Framework-free so the
// per-set winner logic is unit-tested once (score-format.test.ts) and shared
// by every score renderer: organizer bracket/groups, public tournament page,
// mobile page and the visual playoff bracket.
// =============================================================================

/** One set as stored in `matches.sets` jsonb (normalised `{p1,p2}` shape). */
export type DisplaySet = {
  p1: number;
  p2: number;
  tb_p1?: number | null;
  tb_p2?: number | null;
};

/**
 * Who won THIS set (not the match): the side with more games; on equal games
 * the tiebreak decides when it was recorded (a one-sided tiebreak entry
 * counts as that side's win). A genuinely tied set — 6-6 cut short, 0-0
 * leftovers, equal tiebreak points — has no winner.
 */
export function setWinner(s: DisplaySet): "p1" | "p2" | null {
  if (s.p1 !== s.p2) return s.p1 > s.p2 ? "p1" : "p2";
  const t1 = s.tb_p1 ?? null;
  const t2 = s.tb_p2 ?? null;
  if (t1 == null && t2 == null) return null;
  const a = t1 ?? 0;
  const b = t2 ?? 0;
  if (a === b) return null;
  return a > b ? "p1" : "p2";
}
