// =============================================================================
// Podium (winner / runner-up / 3rd place) of a FINISHED tournament, computed
// from the public match list. Pure + framework-free → unit-tested
// (podium.test.ts) and shared by the web and mobile tournament pages.
//
//   – elimination tree (hybrid playoff or single-elimination): the winner of
//     the final (max round) takes gold, the loser silver; the 3rd-place match
//     winner takes bronze when that match exists and is decided;
//   – round-robin: first and second of the overall standings (same math as
//     the group tables — computeRoundRobinStandings); no bronze.
// =============================================================================

import { computeRoundRobinStandings } from "./draw";

export type PodiumMatch = {
  round: number | null;
  stage: "group" | "playoff" | "third_place" | null;
  p1_id: string | null;
  p2_id: string | null;
  winner_id: string | null;
  outcome: string;
  sets: Array<{ p1: number; p2: number }> | null;
};

export type Podium = {
  winner_id: string;
  runner_up_id: string | null;
  third_id: string | null;
};

export function computePodium(
  format: string,
  matches: PodiumMatch[],
  /** Non-withdrawn approved participant ids (pair captains for doubles). */
  activeParticipantIds: string[],
): Podium | null {
  // Elimination tree: hybrid playoff stage, or every match of a legacy
  // single-elimination tournament (stage is null there).
  const elimination = matches.filter(
    (m) =>
      m.round != null &&
      (m.stage === "playoff" || (m.stage == null && format === "single_elimination")),
  );

  if (elimination.length > 0) {
    const maxRound = Math.max(...elimination.map((m) => m.round as number));
    const final = elimination.find((m) => m.round === maxRound && m.winner_id != null);
    if (!final?.winner_id) return null;
    const runnerUp = final.winner_id === final.p1_id ? final.p2_id : final.p1_id;
    const third = matches.find((m) => m.stage === "third_place" && m.winner_id != null);
    return {
      winner_id: final.winner_id,
      runner_up_id: runnerUp,
      third_id: third?.winner_id ?? null,
    };
  }

  if (format === "round_robin") {
    const standings = computeRoundRobinStandings(
      activeParticipantIds,
      matches
        .filter((m) => m.p1_id != null && m.p2_id != null)
        .map((m) => ({
          p1_id: m.p1_id as string,
          p2_id: m.p2_id as string,
          winner_side:
            m.winner_id == null ? null : m.winner_id === m.p1_id ? ("p1" as const) : ("p2" as const),
          outcome: m.outcome,
          sets: m.sets,
        })),
    );
    const first = standings[0];
    if (!first || first.matches_played === 0) return null;
    return {
      winner_id: first.player_id,
      runner_up_id: standings[1]?.player_id ?? null,
      third_id: null,
    };
  }

  return null;
}
