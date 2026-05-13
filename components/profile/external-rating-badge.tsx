import { ExternalLink, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact pill that surfaces a player's external (e.g. Liga Tennisa) rating
 * next to their primary playtennis.by Elo. Server-renderable; deep-links to
 * the source profile so anyone reading the badge can verify the value.
 *
 * Used by:
 *   * the player's own profile page (/me/profile, with a refresh control),
 *   * the public coach profile and (future) public player card,
 *   * the find-opponent results — anywhere we display a player's Elo.
 */
export function ExternalRatingBadge({
  source,
  externalUrl,
  displayTier,
  externalElo,
  externalEloDoubles,
  isCalibratingSingles,
  size = "md",
  className,
  sourceLabel = "Liga Tennisa",
  showDoubles = false,
}: {
  source: "liga_tennisa";
  externalUrl: string;
  displayTier: string;
  externalElo: number;
  externalEloDoubles?: number | null;
  isCalibratingSingles?: boolean;
  size?: "sm" | "md";
  className?: string;
  sourceLabel?: string;
  showDoubles?: boolean;
}) {
  const isSm = size === "sm";
  return (
    <a
      href={externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-source={source}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border bg-grass-50/70 ring-grass-200 transition hover:-translate-y-0.5 hover:bg-grass-100",
        isSm ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        className,
      )}
      title={`${sourceLabel}: ${displayTier} · ${externalElo}`}
    >
      <Trophy className={cn(isSm ? "h-3 w-3" : "h-3.5 w-3.5", "text-grass-700")} aria-hidden />
      <span className="font-semibold uppercase tracking-wider text-grass-800">{displayTier}</span>
      <span
        className={cn(
          "font-mono font-bold tabular-nums text-grass-900",
          isSm ? "text-[11px]" : "text-xs",
        )}
      >
        {externalElo > 0 ? externalElo : "—"}
      </span>
      {showDoubles && externalEloDoubles != null && externalEloDoubles > 0 && (
        <span
          className={cn(
            "font-mono tabular-nums text-grass-700",
            isSm ? "text-[10px]" : "text-[11px]",
          )}
        >
          / {externalEloDoubles}d
        </span>
      )}
      {isCalibratingSingles && (
        <span
          className={cn(
            "rounded-full bg-ball-100 px-1.5 font-semibold text-ball-800 ring-1 ring-ball-200",
            isSm ? "text-[9px]" : "text-[10px]",
          )}
        >
          cal.
        </span>
      )}
      <span className="text-ink-400">{sourceLabel}</span>
      <ExternalLink
        className={cn(
          isSm ? "h-2.5 w-2.5" : "h-3 w-3",
          "text-ink-400 transition group-hover:text-grass-700",
        )}
        aria-hidden
      />
    </a>
  );
}
