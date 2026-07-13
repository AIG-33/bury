import { setRequestLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Trophy, Users } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MContent, MEmptyState, MSegment, MStickyHeader } from "@/components/mobile/m-ui";
import { MFilterTool, MSearchTool } from "@/components/mobile/m-header-tools";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadMyRatingTab, type RatingMatchRow } from "@/lib/rating/history";
import { computeRecord, formatSetsScore } from "@/lib/mobile/format";
import { getMobilePlayLabels, getMobileTabLabels } from "../tab-labels";

// =============================================================================
// Screen 08 — Матчи · история (ТЗ Mobile §7.08).
// Sticky header «Матчи» + search + filter, group-by segment (По дате /
// Турниры / Клубы), dark summary card (сыграно · баланс · винрейт · форма),
// grouped match rows with W/L badges, score and ±ELO.
// =============================================================================

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ group?: string; q?: string; result?: string; period?: string }>;
};

export default async function MobileMatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");

  const group =
    sp.group === "tournaments" ? "tournaments" : sp.group === "clubs" ? "clubs" : "date";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rating = user ? await loadMyRatingTab() : null;
  let matches = (rating?.recentMatches ?? []).filter((m) => m.outcome === "completed");

  // -- Filters ---------------------------------------------------------------
  const q = sp.q?.trim().toLowerCase() ?? "";
  if (q) {
    matches = matches.filter((m) => (m.opponent.display_name ?? "").toLowerCase().includes(q));
  }
  if (sp.result === "wins") matches = matches.filter((m) => m.i_am_winner === true);
  if (sp.result === "losses") matches = matches.filter((m) => m.i_am_winner === false);
  if (sp.period === "30" || sp.period === "90") {
    const cutoff = Date.now() - Number(sp.period) * 24 * 3600_000;
    matches = matches.filter((m) => Date.parse(m.played_at) >= cutoff);
  }

  // -- Summary ---------------------------------------------------------------
  const record = computeRecord(matches.map((m) => m.i_am_winner));
  const form = matches.slice(0, 5).map((m) => m.i_am_winner === true);

  // -- Club names for the "Клубы" grouping ------------------------------------
  const tournamentIds = Array.from(
    new Set(matches.map((m) => m.tournament_id).filter((x): x is string => !!x)),
  );
  const clubNameByTournament = new Map<string, string>();
  if (group === "clubs" && tournamentIds.length > 0) {
    const { data } = (await supabase
      .from("tournaments")
      .select("id, club_id, clubs(name)")
      .in("id", tournamentIds)) as {
      data: Array<{
        id: string;
        club_id: string | null;
        clubs: { name: string } | Array<{ name: string }> | null;
      }> | null;
    };
    for (const row of data ?? []) {
      const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
      if (club?.name) clubNameByTournament.set(row.id, club.name);
    }
  }

  // -- Grouping ---------------------------------------------------------------
  const monthFmt = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Minsk",
  });

  const groupKeyOf = (m: RatingMatchRow): string => {
    if (group === "tournaments") return m.tournament_name ?? t("matches.group_friendly");
    if (group === "clubs") {
      return (
        (m.tournament_id ? clubNameByTournament.get(m.tournament_id) : null) ??
        t("matches.group_no_club")
      );
    }
    const label = monthFmt.format(new Date(m.played_at));
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const groupOrder: string[] = [];
  const groups = new Map<string, RatingMatchRow[]>();
  for (const m of matches) {
    const key = groupKeyOf(m);
    if (!groups.has(key)) {
      groupOrder.push(key);
      groups.set(key, []);
    }
    groups.get(key)!.push(m);
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Minsk",
  });

  const segHref = (nextGroup: string) => {
    const next = new URLSearchParams();
    if (nextGroup !== "date") next.set("group", nextGroup);
    for (const key of ["q", "result", "period"] as const) {
      if (sp[key]) next.set(key, sp[key] as string);
    }
    const qs = next.toString();
    return `/m/matches${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <MStickyHeader
        title={t("matches.title")}
        actions={
          <>
            <MSearchTool
              placeholder={t("matches.search_placeholder")}
              ariaLabel={t("common.search")}
            />
            <MFilterTool
              title={t("common.filters")}
              applyLabel={t("common.apply")}
              resetLabel={t("common.reset")}
              anyLabel={t("common.any")}
              ariaLabel={t("common.filters")}
              groups={[
                {
                  param: "result",
                  label: t("matches.filter_result"),
                  options: [
                    { value: "wins", label: t("matches.result_wins") },
                    { value: "losses", label: t("matches.result_losses") },
                  ],
                },
                {
                  param: "period",
                  label: t("matches.filter_period"),
                  options: [
                    { value: "30", label: t("matches.period_30") },
                    { value: "90", label: t("matches.period_90") },
                  ],
                },
              ]}
            />
          </>
        }
      >
        <div className="mt-3">
          <MSegment
            items={[
              { label: t("matches.seg_date"), href: segHref("date"), active: group === "date" },
              {
                label: t("matches.seg_tournaments"),
                href: segHref("tournaments"),
                active: group === "tournaments",
              },
              { label: t("matches.seg_clubs"), href: segHref("clubs"), active: group === "clubs" },
            ]}
          />
        </div>
      </MStickyHeader>

      <MContent className="flex-1 pt-4">
        {!user ? (
          <MEmptyState
            title={t("common.login_required_title")}
            body={t("common.login_required_body")}
            cta={t("common.login")}
            href="/login"
          />
        ) : (
          <>
            <div
              className="relative overflow-hidden rounded-[16px] p-4 text-white"
              style={{ background: "linear-gradient(135deg,#12331F,#1C6B40 70%,#2A9556)" }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(45% 55% at 95% 0%, rgba(195,232,79,0.22) 0%, transparent 70%)",
                }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-white/60">
                    {t("matches.summary_played")}
                  </p>
                  <p className="mt-1 font-mono text-[20px] font-bold tabular-nums">
                    {record.played}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-white/60">
                    {t("matches.summary_balance")}
                  </p>
                  <p className="mt-1 font-mono text-[20px] font-bold tabular-nums text-ball-500">
                    {record.wins}–{record.losses}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-white/60">
                    {t("matches.summary_winrate")}
                  </p>
                  <p className="mt-1 font-mono text-[20px] font-bold tabular-nums">
                    {record.winrate != null ? `${record.winrate}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-white/60">
                    {t("matches.summary_form")}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    {form.length === 0 ? (
                      <span className="text-[12px] text-white/50">—</span>
                    ) : (
                      form.map((won, i) => (
                        <span
                          key={i}
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: won ? "#C3E84F" : "#FF8A7A" }}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="mt-4">
                <MEmptyState
                  title={t("matches.empty_title")}
                  body={t("matches.empty_body")}
                  cta={t("feed.find_game")}
                  href="/m/game"
                />
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {groupOrder.map((key) => {
                  const list = groups.get(key)!;
                  const eloSum = list.reduce((sum, m) => sum + (m.delta ?? 0), 0);
                  return (
                    <section key={key}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] bg-pt-icon text-grass-600">
                          {group === "tournaments" ? (
                            <Trophy className="h-3 w-3" strokeWidth={2} />
                          ) : group === "clubs" ? (
                            <Users className="h-3 w-3" strokeWidth={2} />
                          ) : (
                            <CalendarDays className="h-3 w-3" strokeWidth={2} />
                          )}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink-900">
                          {key}
                          <span className="ml-1.5 font-mono text-[11px] font-bold text-[#8AA093]">
                            {list.length}
                          </span>
                        </p>
                        {eloSum !== 0 ? (
                          <span
                            className={`font-mono text-[12px] font-bold tabular-nums ${
                              eloSum > 0 ? "text-grass-600" : "text-clay-500"
                            }`}
                          >
                            {eloSum > 0 ? `+${eloSum}` : eloSum}
                          </span>
                        ) : null}
                      </div>

                      <ul className="space-y-[8px]">
                        {list.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center gap-3 rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                          >
                            <span
                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[12.5px] font-extrabold ${
                                m.i_am_winner
                                  ? "bg-grass-50 text-[#2C7A4C]"
                                  : "bg-clay-100 text-clay-500"
                              }`}
                            >
                              {m.i_am_winner ? t("common.result_w") : t("common.result_l")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-bold text-ink-900">
                                {m.opponent.display_name ?? t("common.player_unknown")}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] font-semibold text-ink-500">
                                {[
                                  dateFmt.format(new Date(m.played_at)),
                                  m.tournament_name ?? t("feed.friendly_match"),
                                ].join(" · ")}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5">
                              <span className="font-mono text-[13.5px] font-bold tabular-nums text-ink-700">
                                {formatSetsScore(m.sets, m.is_p1) || t("matches.no_score")}
                              </span>
                              {m.delta != null ? (
                                <span
                                  className={`font-mono text-[11px] font-bold tabular-nums ${
                                    m.delta >= 0 ? "text-grass-600" : "text-clay-500"
                                  }`}
                                >
                                  {m.delta >= 0 ? `+${m.delta}` : m.delta}
                                </span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} playLabels={getMobilePlayLabels(t)} authed={!!user} />
    </div>
  );
}
