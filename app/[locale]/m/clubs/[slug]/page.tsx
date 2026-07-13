import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Lock, LockOpen, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/routing";
import { MContent, MCtaBar, MEmptyState, MSegment, MStatTile } from "@/components/mobile/m-ui";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { loadClubBySlug, loadClubRatingBoard } from "@/app/[locale]/clubs/actions";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import { initialsOf } from "@/lib/mobile/format";
import { getMobilePlayLabels, getMobileTabLabels } from "@/app/[locale]/m/tab-labels";
import { ClubApplyCta } from "./apply-cta";

// =============================================================================
// Screen 05 — Карточка клуба (ТЗ Mobile §7.05 + «Tournament Page» design).
// Dark themed header (radius 24) with the owner's branding: banner + scrim,
// logo tile, title override / tagline, sponsor strip with clickable logos.
// Then a 3×2 stat grid, segment Рейтинг / О клубе, fixed CTA above the tab
// bar («Подать заявку» / «Редактировать клуб» for owners & co-admins).
// =============================================================================

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function MobileClubDetailPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");

  const result = await loadClubBySlug(slug);
  if (!result.ok) notFound();
  const { club, stats, coaches, players, viewer, venues } = result;

  const board = await loadClubRatingBoard(club.id);
  const tab = sp.tab === "about" ? "about" : "rating";

  const branding = club.branding;
  const theme = buildRoomTheme(branding);
  const title = branding.title_override || club.name;
  const logoUrl = theme.logoUrl ?? club.logo_url;

  const canManage = viewer.is_owner || (viewer.role === "admin" && viewer.status === "approved");

  const ctaState = !viewer.authenticated
    ? ("guest" as const)
    : canManage
      ? ("manage" as const)
      : viewer.status === "approved"
        ? ("approved" as const)
        : viewer.status === "pending"
          ? ("pending" as const)
          : club.join_policy === "closed"
            ? ("closed" as const)
            : ("none" as const);

  // Rating list: club board when enabled, otherwise the roster by Elo.
  const standings =
    board.enabled && board.standings.length > 0
      ? board.standings.map((s) => ({
          id: s.player_id,
          name: s.display_name,
          rating: s.rating,
          record: `${s.wins}–${s.losses}`,
          positive: s.wins >= s.losses,
        }))
      : [...coaches, ...players]
          .sort((a, b) => b.current_elo - a.current_elo)
          .map((m) => ({
            id: m.user_id,
            name: m.display_name,
            rating: m.current_elo,
            record: null as string | null,
            positive: true,
          }));

  // Themed header background: custom colors when the owner set them,
  // otherwise the default brand gradient. Text over a banner sits on a dark
  // scrim (always white); over a flat custom color we use the auto-picked
  // contrast color from buildRoomTheme.
  const hasCustomBackground = Object.keys(theme.backgroundStyle).length > 0;
  const headerBackground = hasCustomBackground
    ? theme.backgroundStyle
    : { background: "linear-gradient(135deg,#12331F,#1C6B40 60%,#2A9556)" };
  const headerTextColor = theme.bannerImageStyle
    ? "#ffffff"
    : hasCustomBackground
      ? theme.textColor
      : "#ffffff";

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="relative overflow-hidden"
        style={{
          ...headerBackground,
          color: headerTextColor,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        {/* Banner image + scrim (branding), else the lime corner glow. */}
        {theme.bannerImageStyle ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: theme.bannerImageStyle }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `linear-gradient(to top, rgba(0,0,0,${theme.scrimOpacity}) 0%, rgba(0,0,0,${Math.max(
                  0,
                  theme.scrimOpacity - 0.2,
                )}) 60%, rgba(0,0,0,${Math.max(0, theme.scrimOpacity - 0.35)}) 100%)`,
              }}
            />
          </>
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(42% 48% at 92% 4%, rgba(195,232,79,0.3) 0%, transparent 70%)",
            }}
          />
        )}
        {/* Accent top bar (branding). */}
        {theme.accentColor ? (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0"
            style={{ height: 4, backgroundColor: theme.accentColor }}
          />
        ) : null}

        <div
          className="relative mx-auto w-full max-w-[430px] px-[18px] pb-5"
          style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
        >
          <div className="pt-2">
            <MBackButtonDark label={t("common.back")} />
          </div>
          <div className="mt-4 flex items-center gap-3.5">
            <span
              className="grid h-[60px] w-[60px] shrink-0 place-items-center overflow-hidden rounded-[17px] font-display text-[19px] font-extrabold text-grass-700"
              style={{
                background: "linear-gradient(135deg,#E7F4D9,#D3ECC4)",
                boxShadow: theme.accentColor ? `0 0 0 2px ${theme.accentColor}` : undefined,
              }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(club.name)
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[22px] font-extrabold leading-[1.1] tracking-[-0.5px]">
                {title}
              </h1>
              {branding.tagline ? (
                <p className="mt-0.5 truncate text-[12px] font-semibold" style={{ opacity: 0.75 }}>
                  {branding.tagline}
                </p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <DarkAccessBadge policy={club.join_policy} t={t} />
                <span className="text-[11.5px] font-semibold" style={{ opacity: 0.7 }}>
                  {[club.city, t("clubs.members_count", { count: stats.members_total })]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </div>
          </div>

          {/* Sponsor strip — logos link out to the sponsor's site. */}
          {branding.sponsors.length > 0 ? (
            <div className="mt-4">
              <p
                className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.2px]"
                style={{ opacity: 0.6 }}
              >
                {t("club.sponsors_label")}
              </p>
              <ul className="flex flex-wrap items-center gap-2">
                {branding.sponsors.map((s, i) => (
                  <li key={i}>
                    <SponsorBadge sponsor={s} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </header>

      <MContent className="flex-1 pt-4" extraBottom={72}>
        <div className="grid grid-cols-3 gap-2">
          <MStatTile value={stats.members_total} label={t("club.stat_members")} />
          <MStatTile value={Math.round(stats.avg_elo)} label={t("club.stat_avg_elo")} accent />
          <MStatTile value={Math.round(stats.top5_avg_elo)} label={t("club.stat_top5")} />
          <MStatTile value={stats.coaches_total} label={t("club.stat_coaches")} />
          <MStatTile value={stats.active_30d} label={t("club.stat_active")} />
          <MStatTile value={stats.tournaments_total} label={t("club.stat_tournaments")} />
        </div>

        <div className="mt-4">
          <MSegment
            items={[
              {
                label: board.label ?? t("club.seg_rating"),
                href: `/m/clubs/${slug}`,
                active: tab === "rating",
              },
              {
                label: t("club.seg_about"),
                href: `/m/clubs/${slug}?tab=about`,
                active: tab === "about",
              },
            ]}
          />
        </div>

        <div className="mt-4">
          {tab === "rating" ? (
            standings.length === 0 ? (
              <MEmptyState
                title={t("club.empty_rating_title")}
                body={t("club.empty_rating_body")}
              />
            ) : (
              <div className="space-y-[8px]">
                {standings.map((row, i) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(20,60,30,0.04)]"
                  >
                    <span
                      className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] font-mono text-[12px] font-bold tabular-nums ${
                        i < 3 ? "bg-ball-100 text-ball-700" : "bg-ink-50 text-ink-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink-900">
                      {row.name ?? t("common.player_unknown")}
                    </p>
                    {row.record ? (
                      <span
                        className={`font-mono text-[11.5px] font-bold tabular-nums ${
                          row.positive ? "text-grass-600" : "text-clay-500"
                        }`}
                      >
                        {row.record}
                      </span>
                    ) : null}
                    <span className="font-mono text-[14px] font-bold tabular-nums text-ink-900">
                      {row.rating}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              {club.description ? (
                <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
                  <p className="whitespace-pre-line text-[13.5px] leading-[1.4] text-ink-900">
                    {club.description}
                  </p>
                </div>
              ) : (
                <MEmptyState
                  title={t("club.empty_about_title")}
                  body={t("club.empty_about_body")}
                />
              )}
              {venues.length > 0 ? (
                <div className="rounded-[14px] border border-[rgba(20,60,30,0.06)] bg-white p-4 shadow-[0_1px_2px_rgba(20,60,30,0.04)]">
                  <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#8AA093]">
                    {t("club.venues_label")}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {venues.map((v) => (
                      <li key={v.id} className="text-[13px] font-bold text-ink-900">
                        {v.name}
                        {v.city ? (
                          <span className="font-semibold text-ink-500"> · {v.city}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </MContent>

      <MCtaBar aboveTabBar>
        <ClubApplyCta
          clubId={club.id}
          state={ctaState}
          accentColor={theme.accentColor}
          labels={{
            apply: t("club.cta_apply"),
            login: t("tournament.cta_login"),
            pending: t("club.cta_pending"),
            approved: t("club.cta_member"),
            closed: t("club.cta_closed"),
            manage: t("club.cta_manage"),
            error: t("common.error_generic"),
          }}
        />
      </MCtaBar>

      <MTabBar
        labels={getMobileTabLabels(t)}
        playLabels={getMobilePlayLabels(t)}
        authed={viewer.authenticated}
      />
    </div>
  );
}

// Dark-header variant of the back button (glass over gradient).
function MBackButtonDark({ label }: { label: string }) {
  return (
    <Link
      href="/m/clubs"
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-[12px] border border-white/20 bg-white/10 text-white backdrop-blur-md transition-opacity active:opacity-85"
    >
      <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={1.8} />
    </Link>
  );
}

// Sponsor logo/name chip; opens the sponsor's site when a URL is set. The
// native shell (native-bridge.tsx) routes off-site anchors to the system
// browser via Capacitor Browser.
function SponsorBadge({
  sponsor,
}: {
  sponsor: { name: string; logo_url: string | null; url: string | null };
}) {
  const inner = sponsor.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sponsor.logo_url}
      alt={sponsor.name}
      title={sponsor.name}
      className="h-7 w-auto max-w-[110px] rounded-[8px] bg-white/90 object-contain px-2 py-1"
    />
  ) : (
    <span className="inline-flex items-center rounded-[8px] bg-white/90 px-2 py-1 text-[11px] font-bold text-ink-800">
      {sponsor.name}
    </span>
  );
  return sponsor.url ? (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex transition-opacity active:opacity-85"
    >
      {inner}
    </a>
  ) : (
    inner
  );
}

function DarkAccessBadge({
  policy,
  t,
}: {
  policy: "open" | "approval" | "closed";
  t: Awaited<ReturnType<typeof getTranslations<"mobile">>>;
}) {
  const cls =
    "inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-1 text-[10.5px] font-extrabold leading-none backdrop-blur-md";
  if (policy === "open") {
    return (
      <span className={`${cls} text-ball-300`}>
        <LockOpen className="h-3 w-3" strokeWidth={2.2} />
        {t("clubs.policy_open")}
      </span>
    );
  }
  if (policy === "approval") {
    return (
      <span className={`${cls} text-[#FBE7B9]`}>
        <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
        {t("clubs.policy_approval")}
      </span>
    );
  }
  return (
    <span className={`${cls} text-white/70`}>
      <Lock className="h-3 w-3" strokeWidth={2.2} />
      {t("clubs.policy_closed")}
    </span>
  );
}
