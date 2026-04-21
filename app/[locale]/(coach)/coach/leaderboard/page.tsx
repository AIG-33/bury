import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Trophy, ArrowUp, ArrowDown, Minus, MapPin } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadCoachLeaderboard } from "./actions";
import { LeaderboardTabs } from "./leaderboard-tabs";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ scope?: string }>;
};

export default async function CoachLeaderboardPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("coachLeaderboard");

  const sp = await searchParams;
  const scope: "mine" | "all" = sp.scope === "all" ? "all" : "mine";

  const result = await loadCoachLeaderboard({ scope });
  if (!result.ok) {
    if (result.error === "not_authenticated") {
      redirect(`/${locale}/login?next=/coach/leaderboard`);
    }
    if (result.error === "not_a_coach") redirect(`/${locale}/me/profile`);
    redirect(`/${locale}/login`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="coach-leaderboard"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LeaderboardTabs
          active={scope}
          totalMine={result.total_my_players}
          totalAll={result.total_directory}
          copy={{
            tab_mine: t("tab_mine"),
            tab_all: t("tab_all"),
          }}
        />
        <p className="text-xs text-ink-500">{t("note_recent_30d")}</p>
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          title={
            scope === "mine"
              ? t("empty_mine_title")
              : t("empty_all_title")
          }
          description={
            scope === "mine"
              ? t("empty_mine_description")
              : t("empty_all_description")
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-grass-50 text-xs uppercase tracking-wider text-grass-800">
              <tr>
                <th className="w-10 py-3 pl-4 text-left">{t("col_rank")}</th>
                <th className="py-3 text-left">{t("col_player")}</th>
                <th className="py-3 text-right">{t("col_elo")}</th>
                <th className="hidden py-3 text-right md:table-cell">
                  {t("col_matches")}
                </th>
                <th className="hidden py-3 text-right sm:table-cell">
                  {t("col_delta_7d")}
                </th>
                <th className="py-3 pr-4 text-right">{t("col_delta_30d")}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, idx) => (
                <tr key={r.id} className="border-t border-ink-100">
                  <td className="py-3 pl-4 align-middle">
                    <RankBadge rank={idx + 1} />
                  </td>
                  <td className="py-3 align-middle">
                    <div className="flex min-w-0 items-center gap-2">
                      {r.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover ring-1 ring-ink-100"
                        />
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ball-100 text-xs font-semibold text-ball-800">
                          {(r.display_name ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">
                          {r.display_name ?? "—"}
                          {r.is_my_player && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-grass-100 px-1.5 py-0 text-[9px] font-semibold uppercase text-grass-800">
                              {t("my_player_badge")}
                            </span>
                          )}
                        </p>
                        {(r.city || r.district_name) && (
                          <p className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                            <MapPin className="h-3 w-3" />
                            {[r.city, r.district_name].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right align-middle">
                    <span className="font-mono text-base font-semibold text-ink-900">
                      {r.current_elo}
                    </span>
                    {r.elo_status === "provisional" && (
                      <p className="text-[10px] uppercase tracking-wider text-ink-400">
                        {t("provisional")}
                      </p>
                    )}
                  </td>
                  <td className="hidden py-3 text-right align-middle text-ink-600 md:table-cell">
                    {r.rated_matches_count}
                  </td>
                  <td className="hidden py-3 text-right align-middle sm:table-cell">
                    <DeltaPill value={r.delta_7d} />
                  </td>
                  <td className="py-3 pr-4 text-right align-middle">
                    <DeltaPill value={r.delta_30d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "bg-ball-200 text-ball-900 ring-2 ring-ball-300"
      : rank === 2
        ? "bg-ink-200 text-ink-800 ring-2 ring-ink-300"
        : rank === 3
          ? "bg-clay-200 text-clay-900 ring-2 ring-clay-300"
          : "bg-ink-50 text-ink-600";
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${cls}`}
    >
      {rank <= 3 ? <Trophy className="h-3 w-3" /> : rank}
    </span>
  );
}

function DeltaPill({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-ink-50 px-1.5 py-0.5 text-[11px] font-mono text-ink-500">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-grass-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-grass-800">
        <ArrowUp className="h-3 w-3" /> +{value}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-clay-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-clay-800">
      <ArrowDown className="h-3 w-3" /> {value}
    </span>
  );
}
