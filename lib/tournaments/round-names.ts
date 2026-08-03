// =============================================================================
// Single source of truth for "playoff round number → human stage name".
//
// Every surface that shows elimination rounds (organizer bracket, public
// bracket / match lists, mobile pages) must resolve titles through
// `playoffStageTitle` so that the naming stays consistent:
//   Финал · Полуфинал · 1/4 финала · 1/8 финала · 1/16 финала
//   Final · Semifinal · Quarterfinal · Round of 16 · Round of 32
// The i18n values live per-namespace in messages/{locale}/app.json (keys
// `stage_final`, `stage_semifinal`, `stage_quarterfinal`, `stage_round_of_16`,
// `stage_round_of_32`) — only the mapping is centralized here.
// =============================================================================

export type PlayoffStageKey =
  | "final"
  | "semifinal"
  | "quarterfinal"
  | "round_of_16"
  | "round_of_32";

/**
 * Maps a 1-based playoff round to a named stage, counting from the last round.
 * Returns `null` for rounds deeper than 1/16 финала (Round of 32) — callers
 * fall back to a generic "Раунд {n}" label.
 */
export function playoffStageKey(round: number, maxRound: number): PlayoffStageKey | null {
  switch (maxRound - round) {
    case 0:
      return "final";
    case 1:
      return "semifinal";
    case 2:
      return "quarterfinal";
    case 3:
      return "round_of_16";
    case 4:
      return "round_of_32";
    default:
      return null;
  }
}

/** Localized stage names; field names intentionally mirror the i18n keys. */
export type PlayoffStageLabels = {
  stage_final: string;
  stage_semifinal: string;
  stage_quarterfinal: string;
  stage_round_of_16: string;
  stage_round_of_32: string;
  /** Fallback for rounds deeper than Round of 32, e.g. "Раунд {n}". */
  stage_round: (n: number) => string;
};

export function playoffStageTitle(
  round: number,
  maxRound: number,
  labels: PlayoffStageLabels,
): string {
  const key = playoffStageKey(round, maxRound);
  if (key === null) return labels.stage_round(round);
  return labels[`stage_${key}`];
}
