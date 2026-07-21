import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { buildClubJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { ArrowLeft, MapPin, Award, Users, Trophy, TrendingUp } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { ClubLogo } from "@/components/clubs/club-logo";
import { JoinPolicyBadge } from "@/components/clubs/join-policy-badge";
import { ClubRatingTable } from "@/components/clubs/club-rating-table";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import { hasClubBranding } from "@/lib/validators/club-branding";
import { loadClubBySlug, loadClubRatingBoard, loadClubTournaments } from "../actions";
import type { JoinPolicy } from "@/lib/clubs/schema";
import { JoinCta } from "./join-cta";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "clubPublic" });
  const res = await loadClubBySlug(slug);
  if (!res.ok) {
    return { title: t("not_found.title") };
  }
  return buildPageMetadata({
    locale,
    path: `/clubs/${slug}`,
    title: res.club.name,
    description:
      res.club.description ??
      (locale === "en"
        ? "Amateur tennis club on PlayTennis"
        : "Любительский теннис-клуб на PlayTennis"),
  });
}

export default async function ClubPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("clubPublic");
  const tCommon = await getTranslations("clubsCommon");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

  const res = await loadClubBySlug(slug);
  if (!res.ok) notFound();
  const { club, stats, coaches, players, venues, viewer } = res;
  const blocks = club.page_blocks;

  const [ratingBoard, clubTournaments] = await Promise.all([
    blocks.rating ? loadClubRatingBoard(club.id) : Promise.resolve(null),
    blocks.tournaments ? loadClubTournaments(club.id) : Promise.resolve([]),
  ]);

  const tRating = await getTranslations("clubRating");

  const ratingTableLabels = {
    rank: tRating("table.rank"),
    player: tRating("table.player"),
    rating: tRating("table.rating"),
    matches: tRating("table.matches"),
    record: tRating("table.record"),
    provisional: tRating("table.provisional"),
  };

  const joinPolicyLabels: Record<JoinPolicy, string> = {
    approval: tCommon("join_policy.approval"),
    open: tCommon("join_policy.open"),
    closed: tCommon("join_policy.closed"),
  };

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  // Branding — same pipeline as the public tournament room. Legacy
  // brand_color / cover_url are already folded into club.branding.
  const theme = buildRoomTheme(club.branding);
  const branded = hasClubBranding(club.branding);
  const accent = theme.accentColor;
  const sponsors = club.branding.sponsors;
  const heroTitle = club.branding.title_override ?? club.name;
  const heroBackground =
    Object.keys(theme.backgroundStyle).length > 0
      ? theme.backgroundStyle
      : { background: "linear-gradient(150deg,#12331F 0%,#1C6B40 55%,#2A9556 100%)" };
  const overBanner = theme.bannerImageStyle != null;
  const heroTextColor =
    overBanner || Object.keys(theme.backgroundStyle).length === 0 ? "#ffffff" : theme.textColor;
  const heroMuted = heroTextColor === "#ffffff" ? "rgba(255,255,255,0.78)" : theme.mutedTextColor;

  const helpPanel = (
    <HelpPanel
      pageId="public-club-detail"
      variant="inline"
      why={t("help.why")}
      what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
      result={[t("help.result.1"), t("help.result.2")]}
    />
  );

  const jsonLd = buildClubJsonLd({
    slug,
    locale,
    name: club.name,
    description: club.description,
    city: club.city,
    logoUrl: club.logo_url,
  });

  return (
    <div style={theme.themed ? theme.backgroundStyle : undefined}>
      <JsonLdScript data={jsonLd} />

      {/* ── Hero: same branded room header as the public tournament page ── */}
      {branded && (
        <div
          className={`relative overflow-hidden ${theme.fontClass}`}
          style={{ ...heroBackground, color: heroTextColor }}
        >
          {accent && <div aria-hidden style={{ height: 4, backgroundColor: accent }} />}

          {overBanner ? (
            <>
              <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: theme.bannerImageStyle! }}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, rgba(0,0,0,${theme.scrimOpacity}) 0%, rgba(0,0,0,${Math.max(
                    0,
                    theme.scrimOpacity - 0.2,
                  )}) 60%, rgba(0,0,0,${Math.max(0, theme.scrimOpacity - 0.35)}) 100%)`,
                }}
              />
            </>
          ) : (
            <CourtLinesPattern />
          )}

          <div className="page-shell relative space-y-6 pb-8 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-full bg-black/25 px-4 py-1.5 backdrop-blur-[6px] [&_a:hover]:text-white [&_a]:text-white/80 [&_span]:text-white [&_svg]:text-white/50">
                <Breadcrumbs
                  locale={locale}
                  items={[
                    { name: tCrumb("home"), path: "" },
                    { name: tNav("clubs"), path: "/clubs" },
                    { name: club.name, path: `/clubs/${slug}` },
                  ]}
                />
              </div>
              <div className="flex items-center gap-2">
                {sponsors.length > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/25 py-1 pl-3 pr-1 text-[10px] font-bold uppercase tracking-[1.2px] text-white/80 backdrop-blur-[6px]">
                    {t("sponsors")}
                    <span className="inline-flex items-center rounded-full bg-white/90 px-1.5 py-0.5">
                      {sponsors[0].logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sponsors[0].logo_url}
                          alt={sponsors[0].name}
                          title={sponsors[0].name}
                          className="h-5 w-auto max-w-[72px] object-contain"
                        />
                      ) : (
                        <span className="text-[10px] font-bold normal-case tracking-normal text-ink-900">
                          {sponsors[0].name}
                        </span>
                      )}
                    </span>
                  </span>
                )}
                {helpPanel}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 pt-6">
              {theme.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={theme.logoUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-2xl border-2 bg-white/95 object-contain sm:h-24 sm:w-24"
                  style={{ borderColor: accent ?? "rgba(255,255,255,0.55)" }}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold text-white"
                    style={{ backgroundColor: accent ?? "#28A35A" }}
                  >
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/90" />
                    {joinPolicyLabels[club.join_policy]}
                  </span>
                  {(club.city || club.district_name) && (
                    <span className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-bold text-white/90 backdrop-blur-[6px]">
                      {[club.city, club.district_name].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
                <h1
                  className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
                  style={{ color: heroTextColor }}
                >
                  {heroTitle}
                </h1>
                {club.branding.tagline && (
                  <p
                    className="mt-1.5 text-sm font-medium sm:text-base"
                    style={{ color: heroMuted }}
                  >
                    {club.branding.tagline}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-shell space-y-6">
        {!branded && (
          <Breadcrumbs
            locale={locale}
            items={[
              { name: tCrumb("home"), path: "" },
              { name: tNav("clubs"), path: "/clubs" },
              { name: club.name, path: `/clubs/${slug}` },
            ]}
          />
        )}
        <Link
          href={`/${locale}/clubs`}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        {/* HEADER — spec §4.5: header card with a lime corner glow. When the
          hero is shown above, the card skips the duplicate title/logo and
          keeps the meta + join CTA. */}
        <Surface variant="card" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(195,232,79,0.35)_0%,transparent_70%)]"
          />
          {accent && (
            <div
              className="-mt-1 mb-4 h-1.5 w-16 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <div className="flex flex-wrap items-start gap-4">
            {!branded && <ClubLogo url={club.logo_url} name={club.name} size="xl" />}
            <div className="min-w-0 flex-1">
              <PageHeader
                title={
                  branded ? (
                    <JoinPolicyBadge policy={club.join_policy} labels={joinPolicyLabels} />
                  ) : (
                    <>
                      {club.name}
                      <JoinPolicyBadge policy={club.join_policy} labels={joinPolicyLabels} />
                    </>
                  )
                }
                subtitle={
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {(club.city || club.district_name) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{[club.city, club.district_name].filter(Boolean).join(" · ")}</span>
                      </span>
                    )}
                    <span className="text-ink-400">·</span>
                    <span>
                      {t("created_at", { date: dateFmt.format(new Date(club.created_at)) })}
                    </span>
                    {club.description && (
                      <span className="mt-1 block w-full whitespace-pre-line text-sm text-ink-700">
                        {club.description}
                      </span>
                    )}
                  </span>
                }
                help={branded ? undefined : helpPanel}
                actions={
                  <JoinCta
                    locale={locale}
                    clubId={club.id}
                    clubName={club.name}
                    joinPolicy={club.join_policy}
                    viewer={viewer}
                  />
                }
              />
            </div>
          </div>
        </Surface>

        {/* STATS */}
        <Surface variant="card" as="section">
          <h2 className="section-title mb-4 text-[18px] md:text-[20px]">{t("stats.title")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label={t("stats.members")} value={stats.members_total} />
            <StatTile label={t("stats.coaches")} value={stats.coaches_total} accent="ball" />
            <StatTile label={t("stats.avg_elo")} value={stats.avg_elo || "—"} />
            <StatTile
              label={t("stats.top5_avg_elo")}
              value={stats.top5_avg_elo || "—"}
              accent="grass"
            />
            <StatTile label={t("stats.active_30d")} value={stats.active_30d} />
            <StatTile label={t("stats.tournaments")} value={stats.tournaments_total} />
          </div>
        </Surface>

        {/* CLUB RATING */}
        {blocks.rating && ratingBoard && ratingBoard.enabled && (
          <Surface variant="card" as="section">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="section-title flex items-center gap-2 text-[18px] md:text-[20px]">
                <TrendingUp className="h-5 w-5" style={accent ? { color: accent } : undefined} />
                {ratingBoard.label || tRating("title")}
              </h2>
              {ratingBoard.standings.length > 0 && (
                <Link
                  href={`/${locale}/clubs/${slug}/rating`}
                  className="text-sm font-medium text-grass-700 hover:text-grass-900"
                >
                  {tRating("see_full")}
                </Link>
              )}
            </div>
            {ratingBoard.standings.length === 0 ? (
              <EmptyState title={tRating("title")} description={tRating("empty")} />
            ) : (
              <ClubRatingTable
                rows={ratingBoard.standings.slice(0, 10)}
                locale={locale}
                labels={ratingTableLabels}
                brandColor={accent}
              />
            )}
          </Surface>
        )}

        {/* CLUB TOURNAMENTS */}
        {blocks.tournaments && clubTournaments.length > 0 && (
          <Surface variant="card" as="section">
            <h2 className="section-title mb-4 flex items-center gap-2 text-[18px] md:text-[20px]">
              <Trophy className="h-5 w-5" style={accent ? { color: accent } : undefined} />
              {tRating("tournaments_title")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {clubTournaments.map((tn) => (
                <Link
                  key={tn.id}
                  href={`/${locale}/tournaments/${tn.id}`}
                  className="surface-row lift-on-hover group flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-900 group-hover:text-grass-800">
                      {tn.name}
                    </span>
                    <span className="text-xs text-ink-500">
                      {dateFmt.format(new Date(tn.starts_on))}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-600">
                    {tRating(`status.${tn.status}`)}
                  </span>
                </Link>
              ))}
            </div>
          </Surface>
        )}

        {/* COACHES */}
        {blocks.roster && (
          <>
            <Surface variant="card" as="section">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="section-title text-[18px] md:text-[20px]">
                  {t("coaches_section.title")}
                </h2>
                <span className="text-xs text-ink-500">
                  {t("coaches_section.count", { n: coaches.length })}
                </span>
              </div>
              {coaches.length === 0 ? (
                <p className="text-sm text-ink-500">{t("coaches_section.empty")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {coaches.map((c) => (
                    <RosterCard
                      key={c.user_id}
                      locale={locale}
                      userId={c.user_id}
                      displayName={c.display_name}
                      avatarUrl={c.avatar_url}
                      eloLine={t("roster_elo", {
                        singles: c.current_elo,
                        doubles: c.current_elo_doubles,
                      })}
                      badge={t("coaches_section.open_profile")}
                      accent
                    />
                  ))}
                </div>
              )}
            </Surface>

            {/* PLAYERS */}
            <Surface variant="card" as="section">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="section-title text-[18px] md:text-[20px]">
                  {t("players_section.title")}
                </h2>
                <span className="text-xs text-ink-500">
                  {t("players_section.count", { n: players.length })}
                </span>
              </div>
              {players.length === 0 ? (
                <p className="text-sm text-ink-500">{t("players_section.empty")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {players.map((p) => (
                    <RosterCard
                      key={p.user_id}
                      locale={locale}
                      userId={p.user_id}
                      displayName={p.display_name}
                      avatarUrl={p.avatar_url}
                      eloLine={t("roster_elo", {
                        singles: p.current_elo,
                        doubles: p.current_elo_doubles,
                      })}
                    />
                  ))}
                </div>
              )}
            </Surface>
          </>
        )}

        {/* VENUES */}
        {blocks.venues && (
          <Surface variant="card" as="section">
            <h2 className="section-title mb-4 text-[18px] md:text-[20px]">
              {t("venues_section.title")}
            </h2>
            {venues.length === 0 ? (
              <EmptyState
                title={t("venues_section.title")}
                description={t("venues_section.empty")}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {venues.map((v) => (
                  <Link
                    key={v.id}
                    href={`/${locale}/venues/${v.id}`}
                    className="surface-row lift-on-hover group flex items-start gap-3"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-grass-50 text-grass-700">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 group-hover:text-grass-800">
                        {v.name}
                      </p>
                      {(v.city || v.district_name) && (
                        <p className="text-xs text-ink-500">
                          {[v.city, v.district_name].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Surface>
        )}

        {/* PARTNERS — logos link out to the sponsor's site when a URL is set */}
        {sponsors.length > 0 && (
          <Surface variant="card" as="section">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <p className="label-eyebrow">{t("sponsors")}</p>
              <ul className="flex flex-wrap items-center gap-3">
                {sponsors.map((s, i) => {
                  const inner = s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.logo_url}
                      alt={s.name}
                      title={s.name}
                      className="h-9 w-auto max-w-[130px] rounded bg-white object-contain px-2 py-1"
                    />
                  ) : (
                    <span className="inline-flex items-center rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-xs font-bold text-ink-800">
                      {s.name}
                    </span>
                  );
                  return (
                    <li key={i}>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer noopener nofollow"
                          className="inline-flex"
                        >
                          {inner}
                        </a>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
}

/** Faint tennis-court lines over the default hero gradient (mockup art). */
function CourtLinesPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="2"
    >
      <rect x="140" y="-60" width="920" height="360" />
      <line x1="140" y1="120" x2="1060" y2="120" />
      <line x1="600" y1="-60" x2="600" y2="300" />
      <line x1="340" y1="-60" x2="340" y2="300" />
      <line x1="860" y1="-60" x2="860" y2="300" />
      <line x1="340" y1="220" x2="860" y2="220" />
    </svg>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "grass" | "ball" | "clay";
}) {
  const tone =
    accent === "grass"
      ? "text-grass-800"
      : accent === "ball"
        ? "text-ball-700"
        : accent === "clay"
          ? "text-clay-700"
          : "text-ink-900";
  return (
    <div className="stat-tile">
      <p className="label-eyebrow">{label}</p>
      <p className={`stat-tile-value ${tone}`}>{value}</p>
    </div>
  );
}

function RosterCard({
  locale,
  userId,
  displayName,
  avatarUrl,
  eloLine,
  badge,
  accent,
}: {
  locale: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  eloLine: string;
  badge?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={`/${locale}/players/${userId}`}
      className="surface-row lift-on-hover group flex items-center gap-3"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full border border-ink-100 object-cover"
        />
      ) : (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500">
          <Users className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink-900 group-hover:text-grass-800">
          {displayName ?? "—"}
        </p>
        <p className="font-mono text-xs tabular-nums text-ink-500">{eloLine}</p>
      </div>
      {accent && badge && (
        <span className="hidden text-xs text-grass-700 sm:inline">
          <Award className="inline h-3 w-3" /> {badge}
        </span>
      )}
    </Link>
  );
}
