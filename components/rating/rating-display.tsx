import * as React from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for rendering a player's rating across the site.
 *
 * The internal Elo is the dominant number (bold, grass-900, tabular-nums).
 * The optional external rating (currently only Liga Tennisa) is rendered in
 * parentheses, smaller and muted, with an outbound link to the source profile.
 *
 * Variants:
 *   - "inline"  → "1450 (1488 LT)" on a single line. Used in catalog rows,
 *                 finder cards, proposal cards, match cards, leaderboard.
 *   - "stacked" → big internal number on top, external on a second line with
 *                 the source label. Used for the hero on /me/rating and
 *                 /players/[id].
 *
 * Sizes: sm (lists), md (cards), lg (heroes).
 *
 * Translation keys (under namespace "ratingDisplay"):
 *   - "internal_label"          ("Наш Elo")
 *   - "internal_provisional"    ("предварительный")
 *   - "external_short.{source}" ("LT")
 *   - "external_full.{source}"  ("Liga Tennisa")
 *   - "calibrating"             ("калибровка")
 *   - "open_on_source"          ("Открыть на Liga Tennisa")
 */

export type RatingDisplaySource = "liga_tennisa";

export type RatingDisplayExternal = {
  source: RatingDisplaySource;
  /** Singles Elo in the external system (bold number in parens). */
  elo: number;
  /** Tier label like "Legger" — shown only in the stacked variant. */
  displayTier?: string | null;
  /** Deep link to the player's profile in the external system. */
  externalUrl?: string | null;
  /** When the snapshot was last refreshed (ISO string). */
  lastRefreshedAt?: string | null;
  /** External-system "still calibrating" flag. */
  isCalibrating?: boolean;
};

export type RatingDisplayProps = {
  internalElo: number;
  internalStatus?: "provisional" | "established";
  external?: RatingDisplayExternal | null;
  variant?: "inline" | "stacked";
  size?: "sm" | "md" | "lg";
  /** Hide the LT-in-parens part even if external is provided. */
  hideExternal?: boolean;
  className?: string;
};

const INTERNAL_SIZE = {
  sm: "text-[15px]",
  md: "text-lg",
  lg: "text-3xl md:text-4xl",
} as const;

const EXTERNAL_SIZE = {
  sm: "text-[11.5px]",
  md: "text-xs",
  lg: "text-sm md:text-base",
} as const;

export function RatingDisplay({
  internalElo,
  internalStatus = "established",
  external,
  variant = "inline",
  size = "md",
  hideExternal = false,
  className,
}: RatingDisplayProps) {
  const t = useTranslations("ratingDisplay");
  const showExternal = !hideExternal && external && external.elo > 0;
  const sourceShort = external ? t(`external_short.${external.source}`) : "";
  const sourceFull = external ? t(`external_full.${external.source}`) : "";

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "tabular-nums font-display font-bold leading-none text-grass-900",
              INTERNAL_SIZE[size],
            )}
          >
            {internalElo}
          </span>
          {internalStatus === "provisional" && (
            <span
              className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500"
              title={t("internal_provisional")}
            >
              ~
            </span>
          )}
        </div>

        {showExternal && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-ink-600",
              EXTERNAL_SIZE[size],
            )}
          >
            <span className="font-mono uppercase tracking-[0.14em] text-ink-500">
              {sourceFull}
            </span>
            <span className="text-ink-300" aria-hidden>
              ·
            </span>
            <span className="tabular-nums font-display font-semibold text-ink-800">
              {external!.elo}
            </span>
            {external!.displayTier && (
              <>
                <span className="text-ink-300" aria-hidden>
                  ·
                </span>
                <span className="text-ink-600">{external!.displayTier}</span>
              </>
            )}
            {external!.isCalibrating && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ball-700">
                · {t("calibrating")}
              </span>
            )}
            {external!.externalUrl && (
              <a
                href={external!.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-400 transition-colors hover:text-grass-700"
                aria-label={t("open_on_source", { source: sourceFull })}
                title={t("open_on_source", { source: sourceFull })}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // inline variant
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "tabular-nums font-display font-bold leading-none text-grass-900",
          INTERNAL_SIZE[size],
        )}
      >
        {internalElo}
      </span>
      {internalStatus === "provisional" && (
        <span
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500"
          title={t("internal_provisional")}
        >
          ~
        </span>
      )}
      {showExternal && (
        <span
          className={cn("text-ink-500", EXTERNAL_SIZE[size])}
          title={
            external!.displayTier
              ? `${sourceFull} · ${external!.displayTier}`
              : sourceFull
          }
        >
          {external!.externalUrl ? (
            <a
              href={external!.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-grass-700"
              aria-label={t("open_on_source", { source: sourceFull })}
            >
              (
              <span className="tabular-nums font-semibold text-ink-700">
                {external!.elo}
              </span>{" "}
              <span className="font-mono uppercase tracking-[0.1em]">
                {sourceShort}
              </span>
              )
            </a>
          ) : (
            <>
              (
              <span className="tabular-nums font-semibold text-ink-700">
                {external!.elo}
              </span>{" "}
              <span className="font-mono uppercase tracking-[0.1em]">
                {sourceShort}
              </span>
              )
            </>
          )}
        </span>
      )}
    </span>
  );
}
