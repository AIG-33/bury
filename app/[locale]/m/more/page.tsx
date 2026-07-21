import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  Activity,
  Award,
  Bell,
  BookUser,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Handshake,
  HelpCircle,
  Instagram,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  LogOut,
  MapPin,
  Settings,
  ShieldCheck,
  Star,
  Swords,
  TrendingUp,
  Trophy,
  UserCheck,
  UserRound,
  UserSearch,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MAvatar, MContent, MDarkHeader, MEyebrow } from "@/components/mobile/m-ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadClubRatingBoard } from "@/app/[locale]/clubs/actions";
import { INSTAGRAM_URL } from "@/lib/social-links";
import { getMobilePlayLabels, getMobileTabLabels } from "../tab-labels";
import pkg from "@/package.json";

// =============================================================================
// Screen «Ещё» (design «PlayTennis Navigation», экран 03): mini-profile on a
// dark gradient header (avatar, name, ELO, place in club → tap opens the full
// profile), then EVERY destination without its own tab, grouped Профиль ·
// Игра · Соревнования · Сообщество · Управление (role-aware) · Аккаунт.
// The «Управление» rows come from profiles.is_coach / is_admin — the same
// source the /coach and /admin layouts gate on; both sections carry their own
// SectionNav, so one entry per panel is enough for full reachability.
// Badge counters (notifications) mark what needs attention. «Выйти» is
// separated and painted danger; the app version closes the screen.
// Full flow → menu mapping: docs/FLOWS-CATALOG.md.
// =============================================================================

type Props = { params: Promise<{ locale: string }> };

type MoreItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: "sun";
  badge?: number;
  /** Absolute URL rendered as <a target="_blank"> instead of an internal Link. */
  external?: boolean;
};

export default async function MobileMorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let me: {
    name: string | null;
    avatar: string | null;
    elo: number;
    eloDoubles: number;
  } | null = null;
  let isCoach = false;
  let isAdmin = false;
  let clubRank: number | null = null;
  let freshNotifications = 0;

  if (user) {
    const [profileRes, memberRes, outboxRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url, current_elo, current_elo_doubles, is_coach, is_admin")
        .eq("id", user.id)
        .maybeSingle() as unknown as Promise<{
        data: {
          display_name: string | null;
          avatar_url: string | null;
          current_elo: number;
          current_elo_doubles: number;
          is_coach: boolean;
          is_admin: boolean;
        } | null;
      }>,
      supabase
        .from("club_members")
        .select("club_id, is_primary")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("is_primary", { ascending: false })
        .limit(1) as unknown as Promise<{ data: Array<{ club_id: string }> | null }>,
      supabase
        .from("notifications_outbox")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
        ) as unknown as Promise<{ count: number | null }>,
    ]);

    me = {
      name: profileRes.data?.display_name ?? null,
      avatar: profileRes.data?.avatar_url ?? null,
      elo: profileRes.data?.current_elo ?? 1000,
      eloDoubles: profileRes.data?.current_elo_doubles ?? 1000,
    };
    isCoach = profileRes.data?.is_coach ?? false;
    isAdmin = profileRes.data?.is_admin ?? false;
    freshNotifications = outboxRes.count ?? 0;

    const clubId = memberRes.data?.[0]?.club_id ?? null;
    if (clubId) {
      const board = await loadClubRatingBoard(clubId);
      const idx = board.standings.findIndex((s) => s.player_id === user.id);
      if (idx >= 0) clubRank = idx + 1;
    }
  }

  const profileGroup: MoreItem[] = user
    ? [
        { href: "/m/profile", label: t("more.my_profile"), icon: UserRound },
        { href: "/m/matches", label: t("more.my_stats"), icon: TrendingUp },
        { href: "/me/rating", label: t("more.my_rating"), icon: Activity },
      ]
    : [];

  const playGroup: MoreItem[] = [
    ...(user
      ? [
          { href: "/me/find", label: t("more.find_opponent"), icon: UserSearch },
          { href: "/me/find/proposals", label: t("more.match_proposals"), icon: Handshake },
        ]
      : []),
    { href: "/m/game", label: t("more.open_matches"), icon: Swords },
  ];

  const competitionGroup: MoreItem[] = [
    { href: "/m/rating", label: t("more.leaderboard"), icon: Star, tone: "sun" },
    ...(user
      ? [
          { href: "/m/tournaments?tab=mine", label: t("more.my_tournaments"), icon: Trophy },
          {
            href: "/me/tournaments/organized",
            label: t("more.create_tournament"),
            icon: ClipboardList,
          },
          { href: "/me/bookings", label: t("more.my_bookings"), icon: CalendarDays },
        ]
      : []),
  ];

  const communityGroup: MoreItem[] = [
    { href: "/m/clubs", label: t("more.clubs"), icon: Users },
    ...(user
      ? [
          { href: "/me/clubs", label: t("more.my_clubs"), icon: UserCheck },
          { href: "/me/clubs/owned", label: t("more.manage_clubs"), icon: KeyRound },
        ]
      : []),
    { href: "/m/coaches", label: t("more.coaches"), icon: GraduationCap },
    ...(user ? [{ href: "/me/coaches", label: t("more.my_coaches"), icon: BookUser }] : []),
    { href: "/players", label: t("more.players"), icon: UsersRound },
    { href: "/venues", label: t("more.venues"), icon: MapPin },
  ];

  // Role-gated: /coach/* and /admin/* carry their own section navigation, so a
  // single entry per panel keeps this screen calm while every flow stays
  // reachable.
  const manageGroup: MoreItem[] = [
    ...(isCoach || isAdmin
      ? [{ href: "/coach/dashboard", label: t("more.coach_panel"), icon: LayoutDashboard }]
      : []),
    ...(isAdmin ? [{ href: "/admin", label: t("more.admin_panel"), icon: ShieldCheck }] : []),
  ];

  const accountGroup: MoreItem[] = [
    ...(user
      ? [
          {
            href: "/m/notifications",
            label: t("more.notifications"),
            icon: Bell,
            badge: freshNotifications,
          },
        ]
      : []),
    { href: "/m/settings", label: t("more.settings"), icon: Settings },
    ...(user && !isCoach
      ? [{ href: "/me/become-coach", label: t("more.become_coach"), icon: Award }]
      : []),
    { href: "/help", label: t("more.help"), icon: HelpCircle },
    { href: "/support", label: t("more.support"), icon: LifeBuoy },
    { href: INSTAGRAM_URL, label: t("more.instagram"), icon: Instagram, external: true },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <MDarkHeader radius={26}>
        {me ? (
          <Link
            href={"/m/profile" as never}
            className="flex items-center gap-3 transition-opacity active:opacity-85"
          >
            <MAvatar name={me.name} url={me.avatar} size={52} ring />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[18px] font-extrabold leading-tight">
                {me.name ?? t("home.player_fallback")}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold">
                <span className="font-mono font-bold tabular-nums text-ball-500">
                  {t("more.elo_singles", { elo: me.elo })}
                </span>
                <span className="font-mono font-bold tabular-nums text-white/80">
                  {t("more.elo_doubles", { elo: me.eloDoubles })}
                </span>
                {clubRank ? (
                  <span className="text-white/70">{t("more.club_place", { rank: clubRank })}</span>
                ) : null}
              </span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-white/50" strokeWidth={2} />
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[18px] font-extrabold leading-tight">
                {t("more.guest_title")}
              </p>
              <p className="mt-0.5 text-[12px] font-semibold text-white/70">
                {t("more.guest_body")}
              </p>
            </div>
            <Link
              href="/login"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] bg-ball-500 px-4 font-display text-[13px] font-extrabold text-grass-900 transition-opacity active:opacity-85"
            >
              <LogIn className="h-4 w-4" strokeWidth={2} />
              {t("common.login")}
            </Link>
          </div>
        )}
      </MDarkHeader>

      <MContent className="flex-1 pt-4">
        <div className="space-y-5">
          {profileGroup.length > 0 ? (
            <MoreGroup eyebrow={t("more.group_profile")} items={profileGroup} />
          ) : null}
          <MoreGroup eyebrow={t("more.group_play")} items={playGroup} />
          <MoreGroup eyebrow={t("more.group_competitions")} items={competitionGroup} />
          <MoreGroup eyebrow={t("more.group_community")} items={communityGroup} />
          {manageGroup.length > 0 ? (
            <MoreGroup eyebrow={t("more.group_manage")} items={manageGroup} />
          ) : null}
          <MoreGroup eyebrow={t("more.group_account")} items={accountGroup} />
        </div>

        {user ? (
          <form action="/api/auth/signout" method="post" className="mt-6">
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] border border-clay-200 bg-white font-display text-[14px] font-bold text-clay-500 transition-opacity active:opacity-85"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              {t("more.logout")}
            </button>
          </form>
        ) : null}

        <p className="mt-5 text-center text-[10.5px] font-semibold text-[#A7B5A9]">
          {t("more.version", { version: pkg.version })}
        </p>
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} playLabels={getMobilePlayLabels(t)} authed={!!user} />
    </div>
  );
}

function MoreGroup({ eyebrow, items }: { eyebrow: string; items: MoreItem[] }) {
  return (
    <div>
      <MEyebrow className="mb-2">{eyebrow}</MEyebrow>
      <ul className="space-y-[8px]">
        {items.map((item) => {
          const Icon = item.icon;
          const rowClassName =
            "flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[11px] shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85";
          const rowContent = (
            <>
              <span
                className={[
                  "grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[11px]",
                  item.tone === "sun" ? "bg-sun-50 text-sun-600" : "bg-pt-icon text-grass-600",
                ].join(" ")}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
              </span>
              <span className="flex-1 truncate font-display text-[14.5px] font-bold text-ink-900">
                {item.label}
              </span>
              {item.badge ? (
                <span className="grid h-[20px] min-w-[20px] shrink-0 place-items-center rounded-full bg-grass-600 px-1.5 font-mono text-[10.5px] font-bold tabular-nums text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
              <ChevronRight
                className="h-[16px] w-[16px] shrink-0 text-[#A7B5A9]"
                strokeWidth={2}
              />
            </>
          );
          return (
            <li key={item.href}>
              {item.external ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={rowClassName}
                >
                  {rowContent}
                </a>
              ) : (
                <Link href={item.href as never} className={rowClassName}>
                  {rowContent}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
