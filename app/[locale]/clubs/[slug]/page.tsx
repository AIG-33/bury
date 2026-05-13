import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, MapPin, Award, Users } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { ClubLogo } from "@/components/clubs/club-logo";
import { JoinPolicyBadge } from "@/components/clubs/join-policy-badge";
import { loadClubBySlug } from "../actions";
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
  return {
    title: res.club.name,
    description: res.club.description ?? undefined,
    alternates: {
      canonical: `/${locale}/clubs/${slug}`,
      languages: { ru: `/ru/clubs/${slug}`, en: `/en/clubs/${slug}` },
    },
  };
}

export default async function ClubPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("clubPublic");
  const tCommon = await getTranslations("clubsCommon");

  const res = await loadClubBySlug(slug);
  if (!res.ok) notFound();
  const { club, stats, coaches, players, venues, viewer } = res;

  const joinPolicyLabels: Record<JoinPolicy, string> = {
    approval: tCommon("join_policy.approval"),
    open: tCommon("join_policy.open"),
    closed: tCommon("join_policy.closed"),
  };

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <Link
        href={`/${locale}/clubs`}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      {/* HEADER */}
      <header className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <ClubLogo url={club.logo_url} name={club.name} size="xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="font-display text-3xl font-bold text-ink-900">{club.name}</h1>
              <JoinPolicyBadge policy={club.join_policy} labels={joinPolicyLabels} />
              <HelpPanel
                pageId="public-club-detail"
                variant="inline"
                why={t("help.why")}
                what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
                result={[t("help.result.1"), t("help.result.2")]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
              {(club.city || club.district_name) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{[club.city, club.district_name].filter(Boolean).join(" · ")}</span>
                </span>
              )}
              <span className="text-ink-400">·</span>
              <span>{t("created_at", { date: dateFmt.format(new Date(club.created_at)) })}</span>
            </div>
            {club.description && (
              <p className="whitespace-pre-line text-sm text-ink-700">{club.description}</p>
            )}
          </div>
          <div>
            <JoinCta
              locale={locale}
              clubId={club.id}
              clubName={club.name}
              joinPolicy={club.join_policy}
              viewer={viewer}
            />
          </div>
        </div>
      </header>

      {/* STATS */}
      <section className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">{t("stats.title")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label={t("stats.members")} value={stats.members_total} />
          <StatTile label={t("stats.coaches")} value={stats.coaches_total} accent="ball" />
          <StatTile label={t("stats.avg_elo")} value={stats.avg_elo || "—"} />
          <StatTile label={t("stats.top5_avg_elo")} value={stats.top5_avg_elo || "—"} accent="grass" />
          <StatTile label={t("stats.active_30d")} value={stats.active_30d} />
          <StatTile label={t("stats.tournaments")} value={stats.tournaments_total} />
        </div>
      </section>

      {/* COACHES */}
      <section className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink-900">
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
      </section>

      {/* PLAYERS */}
      <section className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink-900">
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
      </section>

      {/* VENUES */}
      <section className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">
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
                className="group flex items-start gap-3 rounded-lg border border-ink-100 bg-white p-3 transition hover:border-grass-300 hover:bg-grass-50"
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
      </section>
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
      className="group flex items-center gap-3 rounded-lg border border-ink-100 bg-white p-3 transition hover:border-grass-300 hover:bg-grass-50"
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
