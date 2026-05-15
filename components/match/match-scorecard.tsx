import * as React from "react";
import { Trophy } from "lucide-react";
import { Link } from "@/i18n/routing";

/**
 * Compact scorecard for one match, shared between the public matches feed
 * (`/matches`) and the public tournament detail (`/tournaments/[id]`) so
 * both pages render the *same* visual shape — same avatar size, same
 * stacked-names layout, same per-set columns, same winner styling.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ [meta row: any chips]                                 │
 *   │ ────────────────────────────────────────────────      │
 *   │ [BIG]  Player 1 🏆        | 6 | 4 | 10 |              │
 *   │ [BIG]  Player 2           | 3 | 6 |  6 |              │
 *   └──────────────────────────────────────────────────────┘
 *
 * The component is a pure presentational primitive: data shaping happens
 * upstream so each call site can decide which badges (date, tournament,
 * round, venue, …) to surface in the meta row.
 *
 * Avatar + name share one tap target → /coaches/{id} for coaches, otherwise
 * /players/{id}. Set scores sit outside the link so they read as data, not
 * as link text.
 */

export type ScorecardSet = {
  /** This player's games in the set. */
  my: number;
  /** Opponent's games in the set. */
  their: number;
  /** Tiebreak score for this player (rendered as superscript). */
  tb?: number | null;
};

export type ScorecardPlayer = {
  id: string | null;
  name: string | null;
  avatarUrl: string | null;
  isCoach?: boolean | null;
  /** For doubles, displayed under the main name as `+ Partner Name`. */
  partnerName?: string | null;
  isWinner: boolean;
  /** This player's set scores. Same length as the opponent's `sets`. */
  sets: ScorecardSet[];
};

export type MatchScorecardProps = {
  /** Anything that should appear above the player rows: chips, date, badges. */
  meta?: React.ReactNode;
  p1: ScorecardPlayer;
  p2: ScorecardPlayer;
  /** Type accent — affects the left stripe colour and hover border. */
  accent?: "tournament" | "friendly";
  /** Shown as a faint footer row when neither side has played sets yet. */
  noScoreLabel?: string;
  /** SR-only label for the trophy icon next to the winner's name. */
  winnerLabel?: string;
  /** Extra classes for the outer `<li>` wrapper. */
  className?: string;
};

export function MatchScorecard({
  meta,
  p1,
  p2,
  accent = "tournament",
  noScoreLabel,
  winnerLabel,
  className,
}: MatchScorecardProps) {
  const sets = p1.sets;
  const showNoScore = sets.length === 0 && noScoreLabel;

  return (
    <li
      className={[
        "surface-row lift-on-hover relative h-full overflow-hidden",
        accent === "tournament"
          ? "hover:border-ball-200"
          : "hover:border-grass-200",
        className ?? "",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={
          "absolute inset-y-0 left-0 w-1 " +
          (accent === "tournament" ? "bg-ball-400" : "bg-grass-400")
        }
      />

      <div className="space-y-2 pl-4">
        {meta && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-semibold uppercase tracking-wider">
            {meta}
          </div>
        )}

        <div className="rounded-xl border border-ink-100/70 bg-white">
          <PlayerRow position="top" player={p1} winnerLabel={winnerLabel} />
          <PlayerRow position="bottom" player={p2} winnerLabel={winnerLabel} />
          {showNoScore && (
            <p className="border-t border-ink-100/60 px-3 py-1.5 text-center text-[11px] font-medium text-ink-400">
              {noScoreLabel}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function PlayerRow({
  position,
  player,
  winnerLabel,
}: {
  position: "top" | "bottom";
  player: ScorecardPlayer;
  winnerLabel?: string;
}) {
  const display = player.name ?? "—";
  const initial = display.slice(0, 1).toUpperCase();
  const profileHref = player.id
    ? player.isCoach
      ? `/coaches/${player.id}`
      : `/players/${player.id}`
    : null;

  const avatarBlock = player.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={player.avatarUrl}
      alt={display}
      className={
        "h-14 w-14 shrink-0 rounded-full object-cover ring-2 transition group-hover/row:scale-[1.04] " +
        (player.isWinner
          ? "ring-grass-400 shadow-[0_6px_18px_-8px_rgba(31,138,76,0.55)]"
          : "ring-white shadow-[0_4px_14px_-8px_rgba(15,27,20,0.25)]")
      }
    />
  ) : (
    <span
      className={
        "grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-lg font-bold ring-2 transition group-hover/row:scale-[1.04] " +
        (player.isWinner
          ? "bg-grass-100 text-grass-900 ring-grass-400 shadow-[0_6px_18px_-8px_rgba(31,138,76,0.55)]"
          : "bg-ink-100 text-ink-700 ring-white shadow-[0_4px_14px_-8px_rgba(15,27,20,0.25)]")
      }
    >
      {initial}
    </span>
  );

  const nameBlock = (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="flex items-center gap-1.5">
        <span
          className={
            "truncate font-display text-[14px] font-bold leading-tight transition-colors group-hover/row:text-grass-700 " +
            (player.isWinner ? "text-grass-900" : "text-ink-900")
          }
          title={display}
        >
          {display}
        </span>
        {player.isWinner && (
          <Trophy
            className="h-3 w-3 shrink-0 text-grass-600"
            aria-label={winnerLabel}
          />
        )}
      </span>
      {player.partnerName && (
        <span
          className="truncate text-[11px] font-medium text-ink-500"
          title={`+ ${player.partnerName}`}
        >
          + {player.partnerName}
        </span>
      )}
    </span>
  );

  const inner = (
    <>
      {avatarBlock}
      {nameBlock}
    </>
  );

  return (
    <div
      className={
        "flex items-center gap-3 px-2.5 py-2 " +
        (position === "top" ? "border-b border-ink-100/60" : "")
      }
    >
      {profileHref ? (
        <Link
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          href={profileHref as any}
          className="group/row flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-grass-300"
        >
          {inner}
        </Link>
      ) : (
        <div className="group/row flex min-w-0 flex-1 items-center gap-3">
          {inner}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {player.sets.map((s, i) => {
          const wonSet = s.my > s.their;
          return (
            <span
              key={i}
              className={
                "inline-flex h-8 min-w-[30px] items-center justify-center rounded-md px-1.5 font-mono text-[15px] font-bold tabular-nums leading-none " +
                (wonSet
                  ? "bg-grass-50 text-grass-800 ring-1 ring-grass-200"
                  : "bg-ink-50 text-ink-500 ring-1 ring-ink-100")
              }
            >
              {s.my}
              {s.tb != null && (
                <sup className="ml-0.5 text-[9px] font-bold opacity-80">{s.tb}</sup>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
