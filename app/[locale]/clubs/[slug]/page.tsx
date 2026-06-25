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
        ? "Amateur tennis club in Belarus on PlayTennis.by"
        : "Любительский теннис-клуб в Беларуси на PlayTennis.by"),
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
  const accent = club.brand_color ?? null;

  const jsonLd = buildClubJsonLd({
    slug,
    locale,
    name: club.name,
    description: club.description,
    city: club.city,
    logoUrl: club.logo_url,
  });

  return (
    <div className="page-shell space-y-6">
      <JsonLdScript data={jsonLd} />
      <Breadcrumbs
        locale={locale}
        items={[
          { name: tCrumb("home"), path: "" },
          { name: tNav("clubs"), path: "/clubs" },
          { name: club.name, path: `/clubs/${slug}` },
        ]}
      />
      <Link
        href={`/${locale}/clubs`}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      {/* COVER */}
      {club.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={club.cover_url}
          alt=""
          className="h-40 w-full rounded-2xl border border-ink-100 object-cover sm:h-56"
        />
      )}

      {/* HEADER */}
      <Surface variant="card">
        {accent && (
          <div
            className="mb-4 -mt-1 h-1.5 w-16 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <div className="flex flex-wrap items-start gap-4">
          <ClubLogo url={club.logo_url} name={club.name} size="xl" />
          <div className="min-w-0 flex-1">
            <PageHeader
              title={
                <>
                  {club.name}
                  <JoinPolicyBadge policy={club.join_policy} labels={joinPolicyLabels} />
                </>
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
                  <span>{t("created_at", { date: dateFmt.format(new Date(club.created_at)) })}</span>
                  {club.description && (
                    <span className="mt-1 block w-full whitespace-pre-line text-sm text-ink-700">
                      {club.description}
                    </span>
                  )}
                </span>
              }
              help={
                <HelpPanel
                  pageId="public-club-detail"
                  variant="inline"
                  why={t("help.why")}
                  what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
                  result={[t("help.result.1"), t("help.result.2")]}
                />
              }
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
        <h2 className="mb-4 font-display text-lg font-bold text-grass-900">{t("stats.title")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label={t("stats.members")} value={stats.members_total} />
          <StatTile label={t("stats.coaches")} value={stats.coaches_total} accent="ball" />
          <StatTile label={t("stats.avg_elo")} value={stats.avg_elo || "—"} />
          <StatTile label={t("stats.top5_avg_elo")} value={stats.top5_avg_elo || "—"} accent="grass" />
          <StatTile label={t("stats.active_30d")} value={stats.active_30d} />
          <StatTile label={t("stats.tournaments")} value={stats.tournaments_total} />
        </div>
      </Surface>

      {/* CLUB RATING */}
      {blocks.rating && ratingBoard && ratingBoard.enabled && (
        <Surface variant="card" as="section">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-grass-900">
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
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-grass-900">
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
          <h2 className="font-display text-lg font-bold text-grass-900">
            {t("coaches_section.title")}
          </h2>
          <span className="text-xs text-ink-500">{t("coaches_section.count", { n: coaches.length })}</span>
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
                elo={c.current_elo}
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
          <h2 className="font-display text-lg font-bold text-grass-900">
            {t("players_section.title")}
          </h2>
          <span className="text-xs text-ink-500">{t("players_section.count", { n: players.length })}</span>
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
                elo={p.current_elo}
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
        <h2 className="mb-4 font-display text-lg font-bold text-grass-900">
          {t("venues_section.title")}
        </h2>
        {venues.length === 0 ? (
          <EmptyState title={t("venues_section.title")} description={t("venues_section.empty")} />
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
                  <p className="font-medium text-ink-900 group-hover:text-grass-800">{v.name}</p>
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
    </div>
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
    <div className="rounded-lg border border-ink-100 bg-ink-50/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function RosterCard({
  locale,
  userId,
  displayName,
  avatarUrl,
  elo,
  badge,
  accent,
}: {
  locale: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  elo: number;
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
        <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full border border-ink-100 object-cover" />
      ) : (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500">
          <Users className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink-900 group-hover:text-grass-800">
          {displayName ?? "—"}
        </p>
        <p className="text-xs text-ink-500">Elo <span className="font-mono tabular-nums text-ink-700">{elo}</span></p>
      </div>
      {accent && badge && (
        <span className="hidden text-xs text-grass-700 sm:inline">
          <Award className="inline h-3 w-3" /> {badge}
        </span>
      )}
    </Link>
  );
}
