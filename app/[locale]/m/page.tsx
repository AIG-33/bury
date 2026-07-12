import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Bell, Search, TrendingUp, Trophy, Users } from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { ScoreboardIcon, TennisBallIcon } from "@/components/mobile/m-icons";
import {
  MAvatar,
  MContent,
  MDarkHeader,
  MEyebrow,
  MIconBadge,
  MEmptyState,
} from "@/components/mobile/m-ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelativeShort, formatSetsScore, mergeFeed } from "@/lib/mobile/format";
import { getMobileTabLabels } from "./tab-labels";

// =============================================================================
// Screen 01 — Главная · Лента (ТЗ Mobile §7.01).
// Dark gradient header (avatar ring + greeting + ELO chip + bell), live chip,
// two quick-action buttons, "Что нового" feed rows.
// =============================================================================

type Props = { params: Promise<{ locale: string }> };

type FeedKind = "result" | "registration" | "club" | "sparring";

type FeedItem = {
  kind: FeedKind;
  title: string;
  meta: string;
  href: string;
};

export default async function MobileFeedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // -- Header data ----------------------------------------------------------
  let me: {
    name: string | null;
    avatar: string | null;
    elo: number;
    delta30: number;
  } | null = null;

  if (user) {
    const [{ data: profile }, { data: hist }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url, current_elo")
        .eq("id", user.id)
        .maybeSingle() as unknown as Promise<{
        data: {
          display_name: string | null;
          avatar_url: string | null;
          current_elo: number;
        } | null;
      }>,
      supabase
        .from("rating_history")
        .select("delta, created_at")
        .eq("player_id", user.id)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
        .limit(50) as unknown as Promise<{
        data: Array<{ delta: number; created_at: string }> | null;
      }>,
    ]);
    me = {
      name: profile?.display_name ?? null,
      avatar: profile?.avatar_url ?? null,
      elo: profile?.current_elo ?? 1000,
      delta30: (hist ?? []).reduce((sum, r) => sum + (r.delta ?? 0), 0),
    };
  }

  // -- Live counter + feed sources (all public, anon-friendly) ---------------
  const [liveRes, regRes, matchesRes, clubsRes, openRes] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("privacy", "public")
      .eq("status", "in_progress") as unknown as Promise<{ count: number | null }>,
    supabase
      .from("tournaments")
      .select("id, name, starts_on, created_at")
      .eq("privacy", "public")
      .eq("status", "registration")
      .order("created_at", { ascending: false })
      .limit(4) as unknown as Promise<{
      data: Array<{
        id: string;
        name: string;
        starts_on: string;
        created_at: string;
      }> | null;
    }>,
    supabase
      .from("public_matches_feed")
      .select("id, played_at, winner_side, sets, p1_name, p2_name, tournament_id, tournament_name")
      .order("played_at", { ascending: false, nullsFirst: false })
      .limit(6) as unknown as Promise<{
      data: Array<{
        id: string;
        played_at: string | null;
        winner_side: "p1" | "p2" | null;
        sets: Array<{ p1_games: number; p2_games: number }> | null;
        p1_name: string | null;
        p2_name: string | null;
        tournament_id: string | null;
        tournament_name: string | null;
      }> | null;
    }>,
    supabase
      .from("clubs")
      .select("id, slug, name, city, created_at")
      .order("created_at", { ascending: false })
      .limit(3) as unknown as Promise<{
      data: Array<{
        id: string;
        slug: string;
        name: string;
        city: string | null;
        created_at: string;
      }> | null;
    }>,
    supabase
      .from("open_matches_feed")
      .select("id, creator_name, starts_at, venue_name, venue_city, created_at, status")
      .eq("status", "open")
      .gte("starts_at", new Date(Date.now() - 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(4) as unknown as Promise<{
      data: Array<{
        id: string;
        creator_name: string | null;
        starts_at: string;
        venue_name: string | null;
        venue_city: string | null;
        created_at: string;
        status: string;
      }> | null;
    }>,
  ]);

  const liveCount = liveRes.count ?? 0;
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Minsk",
  });

  const feed = mergeFeed<FeedItem>(
    [
      (matchesRes.data ?? [])
        .filter((m) => m.winner_side && m.played_at)
        .map((m) => {
          const winner = m.winner_side === "p1" ? m.p1_name : m.p2_name;
          const loser = m.winner_side === "p1" ? m.p2_name : m.p1_name;
          const score = formatSetsScore(m.sets, m.winner_side === "p1");
          return {
            at: m.played_at as string,
            payload: {
              kind: "result" as const,
              title: t("feed.item_result", {
                winner: winner ?? "—",
                loser: loser ?? "—",
                score,
              }),
              meta: m.tournament_name ?? t("feed.friendly_match"),
              href: m.tournament_id ? `/m/tournaments/${m.tournament_id}` : "/m/matches",
            },
          };
        }),
      (regRes.data ?? []).map((r) => ({
        at: r.created_at,
        payload: {
          kind: "registration" as const,
          title: t("feed.item_registration", { name: r.name }),
          meta: t("feed.starts_on", { date: dateFmt.format(new Date(r.starts_on)) }),
          href: `/m/tournaments/${r.id}`,
        },
      })),
      (clubsRes.data ?? []).map((c) => ({
        at: c.created_at,
        payload: {
          kind: "club" as const,
          title: t("feed.item_club", { name: c.name }),
          meta: c.city ?? t("feed.club_meta"),
          href: `/m/clubs/${c.slug}`,
        },
      })),
      (openRes.data ?? []).map((o) => ({
        at: o.created_at,
        payload: {
          kind: "sparring" as const,
          title: t("feed.item_sparring", { name: o.creator_name ?? "—" }),
          meta: [dateFmt.format(new Date(o.starts_at)), o.venue_name ?? o.venue_city]
            .filter(Boolean)
            .join(" · "),
          href: "/m/game",
        },
      })),
    ],
    12,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <MDarkHeader radius={26}>
        <div className="flex items-center gap-3">
          {me ? (
            <>
              <MAvatar name={me.name} url={me.avatar} size={44} ring />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-tight text-white/70">{t("feed.greeting")}</p>
                <p className="truncate font-display text-[18px] font-extrabold leading-tight">
                  {me.name ?? t("feed.player_fallback")}
                </p>
              </div>
              <span className="glass-on-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
                <TrendingUp className="h-[13px] w-[13px] text-ball-500" strokeWidth={2} />
                <span className="font-mono text-[13px] font-bold tabular-nums">{me.elo}</span>
                {me.delta30 !== 0 ? (
                  <span
                    className={`font-mono text-[11px] font-bold tabular-nums ${
                      me.delta30 > 0 ? "text-ball-500" : "text-[#FF8A7A]"
                    }`}
                  >
                    {me.delta30 > 0 ? `+${me.delta30}` : me.delta30}
                  </span>
                ) : null}
              </span>
              <Link
                href={"/m/profile" as never}
                aria-label={t("feed.notifications")}
                className="glass-on-dark grid h-10 w-10 place-items-center rounded-[12px] transition-opacity active:opacity-85"
              >
                <Bell className="h-[19px] w-[19px]" strokeWidth={1.8} />
              </Link>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-tight text-white/70">
                  {t("feed.greeting_guest")}
                </p>
                <p className="font-display text-[18px] font-extrabold leading-tight">
                  PlayTennis.by
                </p>
              </div>
              <Link
                href={"/login" as never}
                className="rounded-[12px] bg-ball-500 px-4 py-2.5 font-display text-[13px] font-extrabold text-grass-900 transition-opacity active:opacity-85"
              >
                {t("common.login")}
              </Link>
            </>
          )}
        </div>

        <div className="mt-4">
          {liveCount > 0 ? (
            <Link
              href={"/m/tournaments?tab=live" as never}
              className="glass-on-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold text-ball-300 transition-opacity active:opacity-85"
            >
              <span className="pulse-dot text-ball-500" aria-hidden />
              {t("feed.live_now", { count: liveCount })}
            </Link>
          ) : (
            <Link
              href={"/m/tournaments" as never}
              className="glass-on-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold text-white/80 transition-opacity active:opacity-85"
            >
              <Trophy className="h-[13px] w-[13px]" strokeWidth={1.8} />
              {t("feed.no_live")}
            </Link>
          )}
        </div>
      </MDarkHeader>

      <MContent className="flex-1 pt-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href={"/m/game" as never}
            className="flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-pt-primary font-display text-[14px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85"
          >
            <Search className="h-4 w-4" strokeWidth={2.2} />
            {t("feed.find_game")}
          </Link>
          <Link
            href={"/m/tournaments" as never}
            className="flex h-[46px] items-center justify-center gap-2 rounded-[14px] border border-[rgba(20,60,30,0.12)] bg-white font-display text-[14px] font-extrabold text-grass-900 transition-opacity active:opacity-85"
          >
            <Trophy className="h-4 w-4" strokeWidth={2} />
            {t("feed.to_tournament")}
          </Link>
        </div>

        <MEyebrow className="mb-2.5 mt-6">{t("feed.whats_new")}</MEyebrow>

        {feed.length === 0 ? (
          <MEmptyState
            title={t("feed.empty_title")}
            body={t("feed.empty_body")}
            cta={t("feed.find_game")}
            href="/m/game"
          />
        ) : (
          <ul className="space-y-[9px]">
            {feed.map((entry, i) => (
              <li key={`${entry.payload.kind}-${i}`}>
                <Link
                  href={entry.payload.href as never}
                  className="flex items-center gap-3 rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
                >
                  <FeedBadge kind={entry.payload.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13.5px] font-bold leading-[1.25] text-ink-900">
                      {entry.payload.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">
                      {entry.payload.meta}
                    </p>
                  </div>
                  <span className="shrink-0 self-start pt-0.5 text-[11px] font-semibold text-[#A7B5A9]">
                    {formatRelativeShort(entry.at, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} />
    </div>
  );
}

function FeedBadge({ kind }: { kind: FeedKind }) {
  if (kind === "result") {
    return (
      <MIconBadge size={38} radius={11}>
        <ScoreboardIcon className="h-[19px] w-[19px]" />
      </MIconBadge>
    );
  }
  if (kind === "registration") {
    return (
      <MIconBadge size={38} radius={11} className="bg-grass-600 text-white">
        <Trophy className="h-[19px] w-[19px]" strokeWidth={1.8} />
      </MIconBadge>
    );
  }
  if (kind === "club") {
    return (
      <MIconBadge size={38} radius={11} className="bg-sun-50 text-sun-600">
        <Users className="h-[19px] w-[19px]" strokeWidth={1.8} />
      </MIconBadge>
    );
  }
  return (
    <MIconBadge size={38} radius={11} className="bg-ball-100 text-ball-700">
      <TennisBallIcon className="h-[19px] w-[19px]" />
    </MIconBadge>
  );
}
