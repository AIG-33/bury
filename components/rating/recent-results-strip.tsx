import { useTranslations } from "next-intl";

type Props = {
  /** Newest first, oldest last. We render at most `take` items. */
  results: Array<"W" | "L">;
  take?: number;
  className?: string;
};

// `W W L W W` pill strip rendered on the player profile page so visitors see
// momentum at a glance. Renders nothing when the player has no completed
// matches — otherwise the empty state competes with the visible "0W–0L" pill.
export function RecentResultsStrip({ results, take = 5, className }: Props) {
  const t = useTranslations("levels");
  if (results.length === 0) return null;

  const visible = results.slice(0, take);

  return (
    <div className={["flex items-center gap-1", className ?? ""].join(" ")}>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
        {t("recent_label")}
      </span>
      <span className="flex items-center gap-1">
        {visible.map((r, i) => (
          <span
            key={i}
            aria-label={t(`result_${r}`)}
            title={t(`result_${r}`)}
            className={[
              "inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold",
              r === "W"
                ? "bg-grass-100 text-grass-800 ring-1 ring-grass-300"
                : "bg-clay-50 text-clay-800 ring-1 ring-clay-200",
            ].join(" ")}
          >
            {t(`result_${r}`)}
          </span>
        ))}
      </span>
    </div>
  );
}
