import { useTranslations } from "next-intl";
import { getLevelBand, formatLevelRange, type LevelBandId } from "@/lib/rating/levels";

type Size = "sm" | "md";

type Props = {
  elo: number;
  /** Renders a faint range "(950–1099)" next to the band label. Default true. */
  showRange?: boolean;
  size?: Size;
  className?: string;
};

const TONE_BY_BAND: Record<LevelBandId, string> = {
  beginner: "bg-ink-100 text-ink-700 ring-ink-200",
  improver: "bg-grass-50 text-grass-800 ring-grass-200",
  confident: "bg-grass-100 text-grass-800 ring-grass-300",
  strong: "bg-ball-50 text-ink-800 ring-ball-300",
  elite: "bg-ink-900 text-ball-300 ring-ink-900",
};

// Compact pill labelling the player's Elo band. Used next to the raw number on
// player cards/profile/rating pages so visitors see "Любитель · 950–1099" and
// don't have to translate Elo numbers in their head.
export function LevelBadge({ elo, showRange = true, size = "sm", className }: Props) {
  const t = useTranslations("levels");
  const band = getLevelBand(elo);
  const tone = TONE_BY_BAND[band.id];

  const text = size === "sm" ? "text-[10.5px]" : "text-[11.5px]";
  const pad = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-0.5";

  return (
    <span
      title={`${t(band.id)} · ${formatLevelRange(band)}`}
      className={[
        "inline-flex items-center gap-1 rounded-full font-mono font-semibold uppercase tracking-[0.12em] ring-1",
        tone,
        text,
        pad,
        className ?? "",
      ].join(" ")}
    >
      <span>{t(band.id)}</span>
      {showRange && (
        <span className="font-normal tracking-[0.06em] opacity-70">
          · {formatLevelRange(band)}
        </span>
      )}
    </span>
  );
}
