import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Flame,
  MapPin,
  Plus,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { TennisBallIcon } from "@/components/mobile/m-icons";
import { MAvatar, MContent, MDarkHeader, MEmptyState, MEyebrow } from "@/components/mobile/m-ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOpenMatches } from "@/app/[locale]/open-matches/actions";
import { loadPublicTournaments } from "@/app/[locale]/tournaments/actions";
import { loadClubRatingBoard } from "@/app/[locale]/clubs/actions";
import { loadMyTournaments } from "@/app/[locale]/(player)/me/tournaments/actions";
import type { OpenMatchApplicationStatus } from "@/lib/open-matches/schema";
import { getMobilePlayLabels, getMobileTabLabels } from "./tab-labels";
import { StartScreen } from "./start-screen";
import { PlayButton } from "./game/play-button";

// =============================================================================
// Screen 00/01 — root of the native app (дизайны «PlayTennis Start» и
// «PlayTennis Home»).
//   * Guest → splash + вход: brand hero and a bottom sheet with Apple /
//     Google on top and the primary e-mail sign-in below.
//   * Signed in → personal dashboard: rating band, quick actions, next event
//     card, open games nearby and tournaments closing registration.
// =============================================================================

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ account_deleted?: string }>;
};

export default async function MobileHomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { account_deleted } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const tDel = await getTranslations("accountDeletion");
    // Live proof numbers for the hero chip (both sources are world-readable).
    const [playersRes, clubsRes] = await Promise.all([
      supabase
        .from("public_player_basic")
        .select("id", { count: "exact", head: true }) as unknown as Promise<{
        count: number | null;
      }>,
      supabase.from("clubs").select("id", { count: "exact", head: true }) as unknown as Promise<{
        count: number | null;
      }>,
    ]);
    const players = playersRes.count ?? 0;
    return (
      <StartScreen
        deletedNotice={account_deleted === "1" ? tDel("deleted_banner") : null}
        labels={{
          slogan: t("start.slogan"),
          chip_sparring: t("start.chip_sparring"),
          chip_tournaments: t("start.chip_tournaments"),
          chip_elo: t("start.chip_elo"),
          proof: t("start.proof", {
            players: players >= 20 ? Math.floor(players / 10) * 10 : players,
            clubs: clubsRes.count ?? 0,
          }),
          login_email: t("start.login_email"),
          or: t("start.or"),
          new_here: t("start.new_here"),
          signup: t("start.signup"),
          legal_prefix: t("start.legal_prefix"),
          legal_terms: t("start.legal_terms"),
          legal_and: t("start.legal_and"),
          legal_privacy: t("start.legal_privacy"),
          oauth: {
            // Apple's official localized button title (HIG: use only the
            // official titles, e.g. «Вход с Apple» / "Sign in with Apple").
            apple: t("start.oauth_apple"),
            google: "Google",
            error: t("start.oauth_error"),
            unavailable: t("start.oauth_unavailable"),
            error_detail: t("start.oauth_error_detail"),
          },
        }}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Dashboard data (independent sources fetched in parallel)
  // ---------------------------------------------------------------------------
  const nowIso = new Date().toISOString();

  const [
    profileRes,
    histRes,
    recentRes,
    memberRes,
    myAppsRes,
    myCreatedRes,
    myTournamentsRes,
    openMatchesRes,
    regTournaments,
  ] = await Promise.all([
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
    // The home hero shows the SINGLES Elo, so the 30-day delta must not mix
    // in doubles-ladder rows.
    supabase
      .from("rating_history")
      .select("delta")
      .eq("player_id", user.id)
      .eq("discipline", "singles")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
      .limit(50) as unknown as Promise<{ data: Array<{ delta: number }> | null }>,
    // Completed matches, newest first — the win streak source.
    supabase
      .from("matches")
      .select("p1_id, winner_side, played_at")
      .or(`p1_id.eq.${user.id},p2_id.eq.${user.id}`)
      .eq("outcome", "completed")
      .order("played_at", { ascending: false, nullsFirst: false })
      .limit(20) as unknown as Promise<{
      data: Array<{ p1_id: string; winner_side: "p1" | "p2" | null; played_at: string }> | null;
    }>,
    supabase
      .from("club_members")
      .select("club_id, is_primary")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .order("is_primary", { ascending: false })
      .limit(1) as unknown as Promise<{
      data: Array<{ club_id: string; is_primary: boolean }> | null;
    }>,
    supabase
      .from("open_match_applications")
      .select("open_match_id, status")
      .eq("applicant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30) as unknown as Promise<{
      data: Array<{ open_match_id: string; status: OpenMatchApplicationStatus }> | null;
    }>,
    supabase
      .from("open_matches_feed")
      .select("id, starts_at, venue_name, venue_city, district_name, status")
      .eq("creator_id", user.id)
      .in("status", ["open", "filled"])
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(1) as unknown as Promise<{
      data: Array<{
        id: string;
        starts_at: string;
        venue_name: string | null;
        venue_city: string | null;
        district_name: string | null;
        status: string;
      }> | null;
    }>,
    loadMyTournaments(),
    loadOpenMatches({}),
    loadPublicTournaments({ status: "registration" }),
  ]);

  const me = {
    name: profileRes.data?.display_name ?? null,
    avatar: profileRes.data?.avatar_url ?? null,
    elo: profileRes.data?.current_elo ?? 1000,
    delta30: (histRes.data ?? []).reduce((sum, r) => sum + (r.delta ?? 0), 0),
  };

  // Win streak: consecutive wins from the most recent completed match.
  let streak = 0;
  for (const m of recentRes.data ?? []) {
    const iWon = m.winner_side !== null && (m.winner_side === "p1") === (m.p1_id === user.id);
    if (!iWon) break;
    streak += 1;
  }

  // Club rank: position in the primary club's rating board.
  let clubRank: number | null = null;
  const clubId = memberRes.data?.[0]?.club_id ?? null;
  if (clubId) {
    const board = await loadClubRatingBoard(clubId);
    const idx = board.standings.findIndex((s) => s.player_id === user.id);
    if (idx >= 0) clubRank = idx + 1;
  }

  // ---------------------------------------------------------------------------
  // Next event: accepted sparring application / my open match / tournament game
  // ---------------------------------------------------------------------------
  type UpcomingEvent = {
    at: string;
    hasTime: boolean;
    title: string;
    venue: string | null;
    elo: number | null;
    href: string;
  };
  const candidates: UpcomingEvent[] = [];

  const acceptedIds = (myAppsRes.data ?? [])
    .filter((a) => a.status === "accepted")
    .map((a) => a.open_match_id);
  if (acceptedIds.length > 0) {
    const { data: applied } = (await supabase
      .from("open_matches_feed")
      .select("id, starts_at, creator_name, creator_elo, venue_name, venue_city, district_name")
      .in("id", acceptedIds)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(1)) as {
      data: Array<{
        id: string;
        starts_at: string;
        creator_name: string | null;
        creator_elo: number;
        venue_name: string | null;
        venue_city: string | null;
        district_name: string | null;
      }> | null;
    };
    const row = applied?.[0];
    if (row) {
      candidates.push({
        at: row.starts_at,
        hasTime: true,
        title: t("home.sparring_with", { name: row.creator_name ?? t("common.player_unknown") }),
        venue: row.venue_name ?? row.district_name ?? row.venue_city,
        elo: row.creator_elo,
        href: `/open-matches/${row.id}`,
      });
    }
  }

  const created = myCreatedRes.data?.[0];
  if (created) {
    // Show the accepted opponent's name + ELO when someone already joined.
    let opponentName: string | null = null;
    let opponentElo: number | null = null;
    const { data: acc } = (await supabase
      .from("open_match_applications")
      .select("applicant_id")
      .eq("open_match_id", created.id)
      .eq("status", "accepted")
      .limit(1)) as { data: Array<{ applicant_id: string }> | null };
    if (acc?.[0]) {
      const { data: person } = (await supabase
        .from("public_player_basic")
        .select("display_name, current_elo")
        .eq("id", acc[0].applicant_id)
        .maybeSingle()) as {
        data: { display_name: string | null; current_elo: number } | null;
      };
      opponentName = person?.display_name ?? null;
      opponentElo = person?.current_elo ?? null;
    }
    candidates.push({
      at: created.starts_at,
      hasTime: true,
      title: opponentName
        ? t("home.sparring_with", { name: opponentName })
        : t("start.chip_sparring"),
      venue: created.venue_name ?? created.district_name ?? created.venue_city,
      elo: opponentElo,
      href: `/open-matches/${created.id}`,
    });
  }

  if (myTournamentsRes.ok) {
    for (const row of myTournamentsRes.tournaments) {
      if (row.withdrawn) continue;
      if (row.next_match?.scheduled_at && row.next_match.scheduled_at >= nowIso) {
        candidates.push({
          at: row.next_match.scheduled_at,
          hasTime: true,
          title: t("home.tournament_match", {
            name: row.next_match.opponent_name ?? row.name,
          }),
          venue: null,
          elo: null,
          href: `/m/tournaments/${row.id}`,
        });
      } else if (
        row.application_status === "approved" &&
        (row.status === "registration" || row.status === "in_progress") &&
        row.starts_on >= nowIso.slice(0, 10)
      ) {
        candidates.push({
          at: `${row.starts_on}T00:00:00`,
          hasTime: false,
          title: t("home.tournament_match", { name: row.name }),
          venue: null,
          elo: null,
          href: `/m/tournaments/${row.id}`,
        });
      }
    }
  }

  candidates.sort((a, b) => a.at.localeCompare(b.at));
  const nextEvent = candidates[0] ?? null;

  // ---------------------------------------------------------------------------
  // Open games nearby + tournaments closing registration
  // ---------------------------------------------------------------------------
  const myApplications = new Map((myAppsRes.data ?? []).map((a) => [a.open_match_id, a.status]));
  const nearby = openMatchesRes.rows.filter((r) => r.creator_id !== user.id).slice(0, 2);

  const closing = regTournaments
    .filter((row) => {
      if (!row.max_participants) return true;
      return row.max_participants - row.participants_count > 0;
    })
    .sort((a, b) => {
      const slotsA = a.max_participants ? a.max_participants - a.participants_count : 999;
      const slotsB = b.max_participants ? b.max_participants - b.participants_count : 999;
      return slotsA - slotsB || a.starts_on.localeCompare(b.starts_on);
    })
    .slice(0, 2);

  // ---------------------------------------------------------------------------
  // Formatting helpers (Europe/Minsk)
  // ---------------------------------------------------------------------------
  const tz = "Europe/Minsk";
  const now = new Date();
  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
  const shortDateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: tz,
  });
  const listDateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });

  function eventChip(event: UpcomingEvent): string {
    const date = new Date(event.at);
    const dayKey = dayKeyFmt.format(date);
    const todayKey = dayKeyFmt.format(now);
    const tomorrowKey = dayKeyFmt.format(new Date(now.getTime() + 24 * 3600_000));
    const day =
      dayKey === todayKey
        ? t("home.today")
        : dayKey === tomorrowKey
          ? t("home.tomorrow")
          : shortDateFmt.format(date);
    return event.hasTime ? `${day} · ${timeFmt.format(date)}` : day;
  }

  function eventRelative(event: UpcomingEvent): string | null {
    const diffMs = new Date(event.at).getTime() - now.getTime();
    if (diffMs <= 0) return null;
    const minutes = Math.round(diffMs / 60_000);
    if (!event.hasTime || minutes >= 48 * 60) {
      return t("home.in_days", { days: Math.max(1, Math.round(minutes / (24 * 60))) });
    }
    if (minutes >= 60) return t("home.in_hours", { hours: Math.round(minutes / 60) });
    return t("home.in_minutes", { minutes: Math.max(1, minutes) });
  }

  function routeUrl(venue: string | null): string | null {
    if (!venue) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---- Dark header: greeting + rating band ---- */}
      <MDarkHeader radius={26}>
        <div className="flex items-center gap-3">
          {/* PDF: «профиль всегда доступен по аватару в хедере». */}
          <Link
            href={"/m/profile" as never}
            aria-label={t("profile.title")}
            className="shrink-0 transition-opacity active:opacity-85"
          >
            <MAvatar name={me.name} url={me.avatar} size={46} ring />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-tight text-white/70">{t("home.greeting")}</p>
            <p className="truncate font-display text-[19px] font-extrabold leading-tight">
              {me.name ?? t("home.player_fallback")} <span aria-hidden>👋</span>
            </p>
          </div>
          <Link
            href={"/m/notifications" as never}
            aria-label={t("home.notifications")}
            className="glass-on-dark relative grid h-11 w-11 place-items-center rounded-[13px] transition-opacity active:opacity-85"
          >
            <Bell className="h-[19px] w-[19px]" strokeWidth={1.8} />
            <span
              className="absolute right-[9px] top-[9px] h-[7px] w-[7px] rounded-full bg-ball-500"
              aria-hidden
            />
          </Link>
        </div>

        <div className="glass-on-dark mt-4 grid grid-cols-[1.35fr_1fr_1fr] items-center rounded-[18px] px-4 py-3.5">
          <div className="border-r border-white/15 pr-3">
            <p className="text-[9.5px] font-bold uppercase tracking-[1px] text-white/60">
              {t("home.elo_label")}
            </p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-mono text-[26px] font-bold tabular-nums leading-none">
                {me.elo}
              </span>
              {me.delta30 !== 0 ? (
                <span
                  className={`inline-flex items-center gap-0.5 font-mono text-[12px] font-bold tabular-nums ${
                    me.delta30 > 0 ? "text-ball-500" : "text-[#FF8A7A]"
                  }`}
                >
                  <TrendingUp className="h-3 w-3" strokeWidth={2.4} />
                  {me.delta30 > 0 ? `+${me.delta30}` : me.delta30}
                </span>
              ) : null}
            </p>
          </div>
          <div className="border-r border-white/15 px-3 text-center">
            <p className="font-mono text-[20px] font-bold tabular-nums leading-none">
              {clubRank ? t("home.club_rank", { rank: clubRank }) : t("home.no_club")}
            </p>
            <p className="mt-1 text-[10.5px] font-semibold text-white/60">
              {t("home.club_rank_label")}
            </p>
          </div>
          <div className="pl-3 text-center">
            <p className="flex items-center justify-center gap-1 font-mono text-[20px] font-bold tabular-nums leading-none">
              {streak}
              {streak > 0 ? (
                <Flame className="h-[15px] w-[15px] text-[#FF9A62]" strokeWidth={2.2} aria-hidden />
              ) : null}
            </p>
            <p className="mt-1 text-[10.5px] font-semibold text-white/60">
              {t("home.streak_label")}
            </p>
          </div>
        </div>
      </MDarkHeader>

      <MContent className="flex-1 pt-4">
        {/* ---- Quick actions ---- */}
        <div className="grid grid-cols-3 gap-2.5">
          <QuickAction href="/m/game" label={t("home.qa_find")} primary>
            <TennisBallIcon className="h-[21px] w-[21px]" />
          </QuickAction>
          <QuickAction href="/m/tournaments" label={t("home.qa_tournaments")}>
            <Trophy className="h-[21px] w-[21px]" strokeWidth={1.8} />
          </QuickAction>
          <QuickAction href="/m/record" label={t("home.qa_record")}>
            <Plus className="h-[21px] w-[21px]" strokeWidth={2.2} />
          </QuickAction>
        </div>

        {/* ---- Next event ---- */}
        <div className="mb-2.5 mt-6 flex items-center justify-between">
          <MEyebrow>{t("home.upcoming_eyebrow")}</MEyebrow>
          <Link
            href={"/m/game?tab=mine" as never}
            className="inline-flex items-center gap-1 text-[12.5px] font-extrabold text-grass-600 transition-opacity active:opacity-85"
          >
            {t("home.my_events")}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </Link>
        </div>

        {nextEvent ? (
          <div
            className="relative overflow-hidden rounded-[18px] p-4 text-white"
            style={{ background: "linear-gradient(135deg,#1C6B40,#2A9556)" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(50% 60% at 96% 0%, rgba(195,232,79,0.25) 0%, transparent 70%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-white/[0.18] px-2.5 py-1 text-[11px] font-extrabold uppercase leading-none tracking-[0.4px]">
                  {eventChip(nextEvent)}
                </span>
                <span className="text-[12px] font-semibold text-white/70">
                  {eventRelative(nextEvent)}
                </span>
              </div>
              <p className="mt-2.5 font-display text-[18.5px] font-extrabold leading-tight">
                {nextEvent.title}
              </p>
              {nextEvent.venue || nextEvent.elo ? (
                <p className="mt-1.5 flex items-center gap-3 text-[12.5px] font-semibold text-white/75">
                  {nextEvent.venue ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-[13px] w-[13px]" strokeWidth={2} />
                      {nextEvent.venue}
                    </span>
                  ) : null}
                  {nextEvent.elo ? (
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <TrendingUp className="h-[13px] w-[13px]" strokeWidth={2.2} />
                      ELO {nextEvent.elo}
                    </span>
                  ) : null}
                </p>
              ) : null}
              <div className="mt-3.5 flex gap-2">
                <Link
                  href={nextEvent.href as never}
                  className="flex h-[46px] flex-1 items-center justify-center rounded-[13px] bg-white font-display text-[14.5px] font-extrabold text-grass-700 transition-opacity active:opacity-85"
                >
                  {t("home.open_match")}
                </Link>
                {routeUrl(nextEvent.venue) ? (
                  <a
                    href={routeUrl(nextEvent.venue) as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-on-dark flex h-[46px] items-center justify-center rounded-[13px] px-4 font-display text-[14px] font-bold transition-opacity active:opacity-85"
                  >
                    {t("home.route")}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <MEmptyState
            title={t("home.no_upcoming_title")}
            body={t("home.no_upcoming_body")}
            cta={t("home.qa_find")}
            href="/m/game"
          />
        )}

        {/* ---- Open to play nearby ---- */}
        <div className="mb-2.5 mt-6 flex items-center justify-between">
          <MEyebrow>{t("home.open_nearby_eyebrow")}</MEyebrow>
          <Link
            href={"/m/game" as never}
            className="inline-flex items-center gap-1 text-[12.5px] font-extrabold text-grass-600 transition-opacity active:opacity-85"
          >
            {t("home.all")}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </Link>
        </div>

        {nearby.length === 0 ? (
          <MEmptyState title={t("game.empty_title")} body={t("home.nearby_empty")} />
        ) : (
          <ul className="space-y-[9px]">
            {nearby.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
              >
                {(() => {
                  const identity = (
                    <>
                      <MAvatar name={row.creator_name} url={row.creator_avatar} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-extrabold text-ink-900">
                          {row.creator_name ?? t("common.player_unknown")}
                          <span className="ml-1.5 font-mono text-[12.5px] font-bold tabular-nums text-grass-600">
                            {row.creator_elo}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">
                          {[
                            listDateFmt.format(new Date(row.starts_at)),
                            row.venue_name ?? row.district_name ?? row.venue_city,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </>
                  );
                  return row.creator_name ? (
                    <Link
                      href={`/players/${row.creator_id}` as never}
                      className="flex min-w-0 flex-1 items-center gap-3 transition-opacity active:opacity-85"
                    >
                      {identity}
                    </Link>
                  ) : (
                    identity
                  );
                })()}
                <PlayButton
                  openMatchId={row.id}
                  authenticated
                  alreadyApplied={myApplications.has(row.id)}
                  labels={{
                    play: t("game.play"),
                    applied: t("game.applied"),
                    error: t("common.error_generic"),
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {/* ---- Tournaments closing registration ---- */}
        {closing.length > 0 ? (
          <>
            <MEyebrow className="mb-2.5 mt-6">{t("home.closing_eyebrow")}</MEyebrow>
            <ul className="space-y-[9px]">
              {closing.map((row) => {
                const slots = row.max_participants
                  ? row.max_participants - row.participants_count
                  : null;
                return (
                  <li key={row.id}>
                    <Link
                      href={`/m/tournaments/${row.id}` as never}
                      className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-3 shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
                    >
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] text-grass-600"
                        style={{ background: "linear-gradient(135deg,#E7F4D9,#D3ECC4)" }}
                      >
                        <Trophy className="h-[21px] w-[21px]" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-extrabold text-ink-900">
                          {row.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] font-semibold text-ink-500">
                          {[
                            shortDateFmt.format(new Date(row.starts_on)),
                            slots !== null
                              ? t("home.slots_left", { count: slots })
                              : t("home.registration_open"),
                          ].join(" · ")}
                        </p>
                      </div>
                      <ChevronRight
                        className="h-[18px] w-[18px] shrink-0 text-[#A7B5A9]"
                        strokeWidth={2}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} playLabels={getMobilePlayLabels(t)} authed />
    </div>
  );
}

function QuickAction({
  href,
  label,
  primary = false,
  children,
}: {
  href: string;
  label: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as never}
      className="flex flex-col items-center gap-2 rounded-[16px] border border-[rgba(20,60,30,0.06)] bg-white px-2 py-3.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-[13px] ${
          primary ? "text-white" : "text-grass-600"
        }`}
        style={{
          background: primary
            ? "linear-gradient(135deg,#1C6B40,#2A9556)"
            : "linear-gradient(135deg,#E7F4D9,#D3ECC4)",
        }}
      >
        {children}
      </span>
      <span className="font-display text-[12.5px] font-extrabold leading-none text-ink-900">
        {label}
      </span>
    </Link>
  );
}
