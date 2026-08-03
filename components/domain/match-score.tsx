import { setWinner, type DisplaySet } from "@/lib/tournaments/score-format";

// =============================================================================
// Unified score display: one tile per set, this side's games on top, the
// opponent's below. The digit of the SET winner (more games; tiebreak decides
// equal games — lib/tournaments/score-format.ts) is bold on brand green, the
// loser's is muted; tiebreak points render as a superscript.
//
// Shared by every place a tournament match score appears: the organizer
// bracket/groups (MatchCard), the public tournament page (MatchScorecard),
// the mobile match list and the visual playoff bracket.
// =============================================================================

export type { DisplaySet };

const SIZES = {
  /** Bracket columns / mobile lists — tight. */
  sm: { cell: "min-w-[22px] px-1 text-[11.5px]", tb: "text-[7.5px]" },
  /** Scorecards on the web pages. */
  md: { cell: "min-w-[28px] px-1.5 text-[13.5px]", tb: "text-[8.5px]" },
} as const;

export function MatchScoreTiles({
  sets,
  size = "md",
  className,
}: {
  sets: DisplaySet[] | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (!sets || sets.length === 0) return null;
  return (
    <div className={`flex shrink-0 items-stretch gap-[3px] ${className ?? ""}`}>
      {sets.map((s, i) => {
        const winner = setWinner(s);
        return (
          <span
            key={i}
            className="flex flex-col overflow-hidden rounded-md bg-white ring-1 ring-grass-200/80 shadow-[0_1px_2px_rgba(20,60,30,0.08)]"
          >
            <SetCell games={s.p1} tb={s.tb_p1} won={winner === "p1"} decided={winner != null} size={size} />
            <span aria-hidden className="border-t border-grass-100" />
            <SetCell games={s.p2} tb={s.tb_p2} won={winner === "p2"} decided={winner != null} size={size} />
          </span>
        );
      })}
    </div>
  );
}

function SetCell({
  games,
  tb,
  won,
  decided,
  size,
}: {
  games: number;
  tb?: number | null;
  won: boolean;
  decided: boolean;
  size: keyof typeof SIZES;
}) {
  const sz = SIZES[size];
  const tone = won
    ? "bg-grass-600 font-extrabold text-white"
    : decided
      ? "font-semibold text-ink-400"
      : "font-semibold text-ink-600";
  return (
    <span
      className={`flex flex-1 items-center justify-center py-[2.5px] font-mono leading-none tabular-nums ${sz.cell} ${tone}`}
    >
      {games}
      {tb != null && (
        <sup className={`ml-px font-bold ${sz.tb} ${won ? "text-white/85" : "text-ink-400"}`}>
          {tb}
        </sup>
      )}
    </span>
  );
}
