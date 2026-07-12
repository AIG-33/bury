import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Pencil } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import {
  MAvatar,
  MContent,
  MDarkHeader,
  MEmptyState,
  MEyebrow,
  MStatTile,
} from "@/components/mobile/m-ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadMyRatingTab, type EloPoint } from "@/lib/rating/history";
import { loadMyProfileHeaderStats } from "@/app/[locale]/(player)/me/profile/actions";
import { getLevelBand } from "@/lib/rating/levels";
import { formatSetsScore } from "@/lib/mobile/format";
import { getMobileTabLabels } from "../tab-labels";

// =============================================================================
// Screen 06 — Профиль игрока (ТЗ Mobile §7.06).
// Dark gradient header (avatar ring 64, name 20/800, badge, edit 40×40),
// 4 stat tiles in a row, dark ELO chart card (lime polyline + end dot),
// «Последние матчи» rows with W/L badges.
// =============================================================================

type Props = { params: Promise<{ locale: string }> };

export default async function MobileProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tabBar = <MTabBar labels={getMobileTabLabels(t)} />;

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col">
        <MDarkHeader radius={26}>
          <p className="text-[12px] text-white/70">{t("feed.greeting_guest")}</p>
          <h1 className="mt-0.5 font-display text-[20px] font-extrabold tracking-[-0.5px]">
            {t("profile.title")}
          </h1>
        </MDarkHeader>
        <MContent className="flex-1 pt-6">
          <MEmptyState
            title={t("common.login_required_title")}
            body={t("common.login_required_body")}
            cta={t("common.login")}
            href="/login"
          />
        </MContent>
        {tabBar}
      </div>
    );
  }

  const [{ data: profile }, rating, headerStats, { data: primaryClub }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, city, current_elo")
      .eq("id", user.id)
      .maybeSingle() as unknown as Promise<{
      data: {
        display_name: string | null;
        avatar_url: string | null;
        city: string | null;
        current_elo: number;
      } | null;
    }>,
    loadMyRatingTab(),
    loadMyProfileHeaderStats(),
    supabase
      .from("club_members")
      .select("club_id, clubs!inner(name)")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .eq("is_primary", true)
      .maybeSingle() as unknown as Promise<{
      data: { club_id: string; clubs: { name: string } | Array<{ name: string }> } | null;
    }>,
  ]);

  const elo = rating?.hero.current_elo ?? profile?.current_elo ?? 1000;
  const band = getLevelBand(elo);
  const clubRef = primaryClub?.clubs;
  const clubName = Array.isArray(clubRef) ? clubRef[0]?.name : clubRef?.name;
  const delta30 = rating?.hero.delta_30d ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <MDarkHeader radius={26}>
        <div className="flex items-start justify-between">
          <MAvatar name={profile?.display_name ?? null} url={profile?.avatar_url} size={64} ring />
          <Link
            href={"/me/profile" as never}
            aria-label={t("profile.edit")}
            className="glass-on-dark grid h-10 w-10 place-items-center rounded-[12px] transition-opacity active:opacity-85"
          >
            <Pencil className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
        </div>
        <h1 className="mt-3 font-display text-[20px] font-extrabold leading-tight tracking-[-0.5px]">
          {profile?.display_name ?? t("feed.player_fallback")}
        </h1>
        {profile?.city ? (
          <p className="mt-0.5 text-[12.5px] font-semibold text-white/70">{profile.city}</p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="glass-on-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold text-ball-300">
            {t(`levels_short.${band.id}` as never)}
          </span>
          {clubName ? (
            <span className="glass-on-dark inline-flex items-center rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white/85">
              {clubName}
            </span>
          ) : null}
        </div>
      </MDarkHeader>

      <MContent className="flex-1 pt-4">
        <div className="grid grid-cols-4 gap-2">
          <MStatTile value={elo} label="ELO" accent />
          <MStatTile value={headerStats.matches_total} label={t("profile.stat_matches")} />
          <MStatTile value={headerStats.wins} label={t("profile.stat_wins")} />
          <MStatTile
            value={headerStats.winrate != null ? `${headerStats.winrate}%` : "—"}
            label={t("profile.stat_winrate")}
          />
        </div>

        {rating && rating.history.length >= 2 ? (
          <EloChartCard
            history={rating.history}
            delta30={delta30}
            title={t("profile.chart_title")}
          />
        ) : null}

        <MEyebrow className="mb-2.5 mt-6">{t("profile.recent_matches")}</MEyebrow>
        {!rating || rating.recentMatches.length === 0 ? (
          <MEmptyState
            title={t("profile.empty_matches_title")}
            body={t("profile.empty_matches_body")}
            cta={t("feed.find_game")}
            href="/m/game"
          />
        ) : (
          <ul className="space-y-[8px]">
            {rating.recentMatches.slice(0, 8).map((m) => {
              const won = m.i_am_winner === true;
              const dateLabel = new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "short",
                timeZone: "Europe/Minsk",
              }).format(new Date(m.played_at));
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                >
                  <span
                    className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] text-[12px] font-extrabold ${
                      won ? "bg-grass-50 text-[#2C7A4C]" : "bg-clay-100 text-clay-500"
                    }`}
                  >
                    {won ? t("common.result_w") : t("common.result_l")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-ink-900">
                      {m.opponent.display_name ?? t("common.player_unknown")}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-ink-500">
                      {[m.tournament_name ?? t("feed.friendly_match"), dateLabel].join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.delta != null ? (
                      <span
                        className={`font-mono text-[11.5px] font-bold tabular-nums ${
                          m.delta >= 0 ? "text-grass-600" : "text-clay-500"
                        }`}
                      >
                        {m.delta >= 0 ? `+${m.delta}` : m.delta}
                      </span>
                    ) : null}
                    <span className="font-mono text-[13.5px] font-bold tabular-nums text-ink-700">
                      {formatSetsScore(m.sets, m.is_p1)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </MContent>

      {tabBar}
    </div>
  );
}

// Dark chart card (ТЗ §7.06): radius 16, eyebrow + delta in lime, 3px lime
// polyline with a dot on the last point. Pure SVG — server-rendered.
function EloChartCard({
  history,
  delta30,
  title,
}: {
  history: EloPoint[];
  delta30: number;
  title: string;
}) {
  const values = history.map((p) => p.new_elo);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const W = 320;
  const H = 84;
  const PAD = 6;

  const points = values.map((v, i) => {
    const x = PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const;
  });
  const last = points[points.length - 1];

  return (
    <div
      className="relative mt-4 overflow-hidden rounded-[16px] p-4 text-white"
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
      <div className="relative flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-white/60">{title}</p>
        <span className="font-mono text-[15px] font-bold tabular-nums text-ball-500">
          {delta30 >= 0 ? `+${delta30}` : delta30}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="relative mt-2 h-[84px] w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          points={points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#C3E84F"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {last ? <circle cx={last[0]} cy={last[1]} r={4.5} fill="#C3E84F" /> : null}
      </svg>
    </div>
  );
}
