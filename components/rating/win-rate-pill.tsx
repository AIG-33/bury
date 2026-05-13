import { useTranslations } from "next-intl";

type Props = {
  wins: number;
  losses: number;
  /** Optional class to override font-size / spacing in dense layouts. */
  className?: string;
};

// Small "7W–3L · 70%" pill rendered next to the Elo number on player cards
// and the profile header. We render *nothing* when the player has zero
// completed matches because "0W–0L · 0%" is noise rather than information —
// callers that want an explicit placeholder render it themselves.
export function WinRatePill({ wins, losses, className }: Props) {
  const t = useTranslations("levels");
  const total = wins + losses;
  if (total === 0) return null;
  const percent = Math.round((wins / total) * 100);

  return (
    <span
      className={[
        "inline-flex items-center rounded-full bg-ink-50 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-ink-700 ring-1 ring-ink-200",
        className ?? "",
      ].join(" ")}
    >
      {t("win_rate", { wins, losses, percent })}
    </span>
  );
}
