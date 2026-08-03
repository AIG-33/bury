import { PlayerNameLink } from "@/components/domain/player-name-link";
import { MatchScoreTiles } from "@/components/domain/match-score";

// =============================================================================
// Visual playoff bracket for the PUBLIC tournament pages (web + /m mobile).
//
// Stages render as columns (1/4 → 1/2 → Финал, third-place match as the last
// column) inside a horizontal scroll container; later rounds are vertically
// centered via justify-around, so the tree structure reads from the order
// alone — no SVG connectors. Read-only: score entry lives in the organizer
// bracket (bracket-section.tsx).
// =============================================================================

/** Subset of PublicTournamentDetail["matches"] the bracket needs. */
export type BracketViewMatch = {
  id: string;
  round: number | null;
  bracket_position: number | null;
  p1_id: string | null;
  p2_id: string | null;
  p1_name: string | null;
  p2_name: string | null;
  winner_id: string | null;
  sets: Array<{ p1: number; p2: number; tb_p1?: number | null; tb_p2?: number | null }> | null;
  outcome: string;
  stage: "group" | "playoff" | "third_place" | null;
};

export type PlayoffBracketLabels = {
  stage_final: string;
  stage_semifinal: string;
  stage_quarterfinal: string;
  /** "Раунд {n}" for deep brackets (R16 and earlier). */
  stage_round: (n: number) => string;
  stage_third_place: string;
  tbd: string;
  bye: string;
};

function stageTitle(round: number, maxRound: number, labels: PlayoffBracketLabels): string {
  const fromEnd = maxRound - round;
  if (fromEnd === 0) return labels.stage_final;
  if (fromEnd === 1) return labels.stage_semifinal;
  if (fromEnd === 2) return labels.stage_quarterfinal;
  return labels.stage_round(round);
}

/**
 * @param matches Elimination matches only: stage `playoff` / `third_place`
 *   of a hybrid, or all matches of a legacy single-elimination tournament.
 * @param size    `mobile` — компактные карточки под 390px, `web` — desktop.
 */
export function PlayoffBracketView({
  matches,
  labels,
  size = "web",
}: {
  matches: BracketViewMatch[];
  labels: PlayoffBracketLabels;
  size?: "mobile" | "web";
}) {
  const main = matches
    .filter((m) => m.stage !== "third_place" && m.round != null)
    .sort(
      (a, b) =>
        (a.round ?? 0) - (b.round ?? 0) || (a.bracket_position ?? 0) - (b.bracket_position ?? 0),
    );
  const thirdPlace = matches.find((m) => m.stage === "third_place") ?? null;
  if (main.length === 0) return null;

  const byRound = new Map<number, BracketViewMatch[]>();
  for (const m of main) {
    const r = m.round as number;
    const arr = byRound.get(r) ?? [];
    arr.push(m);
    byRound.set(r, arr);
  }
  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
  const maxRound = rounds[rounds.length - 1];

  const colWidth = size === "mobile" ? "w-[200px]" : "w-[230px]";

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex items-stretch gap-3">
        {rounds.map((round) => (
          <div key={round} className={`${colWidth} flex shrink-0 flex-col`}>
            <p
              className={`mb-2 font-bold uppercase tracking-[0.08em] text-grass-700 ${
                size === "mobile" ? "text-[10px]" : "text-[11px]"
              }`}
            >
              {stageTitle(round, maxRound, labels)}
            </p>
            {/* justify-around centers later rounds against their feeders. */}
            <div className="flex flex-1 flex-col justify-around gap-2">
              {byRound.get(round)!.map((m) => (
                <BracketMatchCard key={m.id} match={m} labels={labels} size={size} />
              ))}
            </div>
          </div>
        ))}

        {thirdPlace && (
          <div className={`${colWidth} flex shrink-0 flex-col`}>
            <p
              className={`mb-2 font-bold uppercase tracking-[0.08em] text-clay-700 ${
                size === "mobile" ? "text-[10px]" : "text-[11px]"
              }`}
            >
              {labels.stage_third_place}
            </p>
            <div className="flex flex-1 flex-col justify-around gap-2">
              <BracketMatchCard match={thirdPlace} labels={labels} size={size} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  labels,
  size,
}: {
  match: BracketViewMatch;
  labels: PlayoffBracketLabels;
  size: "mobile" | "web";
}) {
  const isBye =
    (match.outcome === "walkover_p1" || match.outcome === "walkover_p2") &&
    (match.p1_id == null || match.p2_id == null) &&
    (!match.sets || match.sets.length === 0);
  const hasScore = match.sets != null && match.sets.length > 0;

  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-[rgba(20,60,30,0.08)] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(20,60,30,0.05)]">
      <div className="min-w-0 flex-1">
        <BracketSideRow match={match} side="p1" labels={labels} size={size} isBye={isBye} />
        <div className="my-1 border-t border-dashed border-[rgba(20,60,30,0.08)]" />
        <BracketSideRow match={match} side="p2" labels={labels} size={size} isBye={isBye} />
      </div>
      {/* One tile per set, p1 on top / p2 below — the set winner's digit is
          bold on brand green (per-set logic, not per-match). */}
      {hasScore && <MatchScoreTiles sets={match.sets} size="sm" className="self-center" />}
    </div>
  );
}

function BracketSideRow({
  match,
  side,
  labels,
  size,
  isBye,
}: {
  match: BracketViewMatch;
  side: "p1" | "p2";
  labels: PlayoffBracketLabels;
  size: "mobile" | "web";
  isBye: boolean;
}) {
  const id = side === "p1" ? match.p1_id : match.p2_id;
  const name = side === "p1" ? match.p1_name : match.p2_name;
  const isWinner = match.winner_id != null && id != null && match.winner_id === id;
  const decided = match.winner_id != null;

  const nameCls = `block min-w-0 truncate ${size === "mobile" ? "text-[12.5px]" : "text-[13px]"} ${
    isWinner
      ? "font-bold text-grass-700"
      : decided
        ? "font-medium text-ink-500"
        : id
          ? "font-semibold text-ink-900"
          : "font-medium text-ink-400"
  }`;

  return (
    <span className={nameCls}>
      <PlayerNameLink id={id} name={name} fallback={isBye && !id ? labels.bye : labels.tbd} />
    </span>
  );
}
