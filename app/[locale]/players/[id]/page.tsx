import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Award, CalendarClock, Clock, Hand, MapPin, Trophy, Users } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { LevelBadge } from "@/components/rating/level-badge";
import { RatingDisplay } from "@/components/rating/rating-display";
import { WinRatePill } from "@/components/rating/win-rate-pill";
import { RecentResultsStrip } from "@/components/rating/recent-results-strip";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { loadPublicPlayerProfile } from "../actions";
import { TIME_SLOTS, WEEKDAYS } from "@/lib/profile/schema";

type Props = { params: Promise<{ locale: string; id: string }> };

/**
 * Build a schema.org `SportsPerson` JSON-LD payload so search engines can
 * surface player profiles as rich-results candidates and link them to the
 * PlayTennis.by sports organization. We deliberately surface only public-
 * safe fields (the same allowlist enforced by `lib/players/public-card.ts`)
 * and omit everything that could be considered PII.
 */
function buildPlayerJsonLd(
  profile: NonNullable<Awaited<ReturnType<typeof loadPublicPlayerProfile>>>,
  locale: string,
) {
  const url = `${SITE_URL}/${locale}/players/${profile.id}`;
  const sameAs: string[] = [];
  if (profile.external_rating?.external_url) {
    sameAs.push(profile.external_rating.external_url);
  }

  const homeLocation =
    profile.city || profile.district_name
      ? {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: profile.city ?? undefined,
            addressRegion: profile.district_name ?? undefined,
            addressCountry: "BY",
          },
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "SportsPerson",
    "@id": url,
    name: profile.display_name ?? "—",
    url,
    image: profile.avatar_url ?? undefined,
    sport: "Tennis",
    knowsLanguage: ["ru", "en"],
    homeLocation,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    memberOf: {
      "@type": "SportsOrganization",
      name: "PlayTennis.by",
      url: SITE_URL,
    },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const profile = await loadPublicPlayerProfile(id);
  if (!profile) {
    return {
      title: "—",
      robots: { index: false, follow: false },
    };
  }
  const t = await getTranslations({ locale, namespace: "playersPublic" });
  const name = profile.display_name ?? t("title");
  const place = [profile.city, profile.district_name].filter(Boolean).join(", ");
  const description = place
    ? t("detail.meta_description_place", { name, place })
    : t("detail.meta_description", { name });
  return buildPageMetadata({
    locale,
    path: `/players/${id}`,
    title: name,
    description,
  });
}

export default async function PublicPlayerProfilePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("playersPublic");
  const [profile, supabase] = await Promise.all([
    loadPublicPlayerProfile(id),
    createSupabaseServerClient(),
  ]);
  if (!profile) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = user == null;

  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const slotsByWeekday = new Map<string, string[]>();
  for (const s of profile.available_slots) {
    const arr = slotsByWeekday.get(s.weekday) ?? [];
    arr.push(s.daypart);
    slotsByWeekday.set(s.weekday, arr);
  }

  const jsonLd = buildPlayerJsonLd(profile, locale);

  return (
    <div className="page-shell space-y-6">
      {/* schema.org SportsPerson — only public-safe fields, no PII */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Link
        href="/players"
        className="inline-flex items-center gap-1 text-sm text-ink-600 transition hover:text-grass-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.back")}
      </Link>

      {/* Hero: large portrait on the left spans two rows (PageHeader + stats trio)
          on desktop. On mobile it stacks as a big square photo above the info.
          Goal: the player's face is the first thing you see on the profile. */}
      <section className="grid gap-4 md:grid-cols-[minmax(240px,280px)_1fr] md:items-start">
        <div className="relative md:row-span-2 mx-auto w-full max-w-[420px] md:max-w-none aspect-square md:aspect-auto md:h-full md:min-h-[320px] overflow-hidden rounded-3xl bg-gradient-to-br from-grass-100 via-ball-50 to-grass-50 ring-1 ring-grass-200/60 shadow-sm">
          {profile.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.avatar_url}
              alt={profile.display_name ?? ""}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              {profile.display_name ? (
                <span className="select-none font-display text-7xl font-bold tracking-tight text-grass-600/40">
                  {initialsOf(profile.display_name)}
                </span>
              ) : (
                <Trophy className="h-20 w-20 text-grass-400" />
              )}
            </div>
          )}
          {profile.is_coach && (
            <Link
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              href={`/coaches/${profile.id}` as any}
              className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-grass-700/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-sm backdrop-blur transition hover:bg-grass-700"
            >
              <Award className="h-3 w-3" />
              {t("card.is_coach")}
            </Link>
          )}
        </div>

        <div className="min-w-0">
          <PageHeader
            title={profile.display_name ?? "—"}
            subtitle={
              <span className="flex flex-wrap items-center gap-3">
                <RatingDisplay
                  internalElo={profile.current_elo}
                  internalStatus={profile.elo_status}
                  external={
                    profile.external_rating
                      ? {
                          source: "liga_tennisa",
                          elo: profile.external_rating.external_elo,
                          displayTier: profile.external_rating.display_tier,
                          externalUrl: profile.external_rating.external_url,
                        }
                      : null
                  }
                  variant="inline"
                  size="md"
                />
                <LevelBadge elo={profile.current_elo} size="md" />
                <WinRatePill wins={profile.stats.wins_count} losses={profile.stats.losses_count} />
                {(profile.city || profile.district_name) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {[profile.city, profile.district_name].filter(Boolean).join(" · ")}
                  </span>
                )}
                {profile.dominant_hand && (
                  <span className="inline-flex items-center gap-1">
                    <Hand className="h-4 w-4" />
                    {t(`card.hand_${profile.dominant_hand}`)}
                  </span>
                )}
              </span>
            }
            help={
              <HelpPanel
                pageId={`player-detail-${profile.id}`}
                variant="inline"
                why={t("detail.help.why")}
                what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
                result={[t("detail.help.result.1"), t("detail.help.result.2")]}
              />
            }
            actions={
              <Button asChild variant="primary" size="sm">
                <Link
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  href={
                    (isGuest
                      ? `/login?next=/${locale}/me/find?focus=${profile.id}`
                      : `/me/find?focus=${profile.id}`) as any
                  }
                >
                  {t("card.propose_login")}
                </Link>
              </Button>
            }
          />
        </div>

        {/* Stats trio — sits to the right of the lower half of the portrait */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label={t("detail.stats.elo")}
            value={
              profile.elo_status === "established"
                ? t("card.elo_established", { elo: profile.current_elo })
                : t("card.elo_provisional", { elo: profile.current_elo })
            }
          />
          <Stat label={t("detail.stats.rated_matches")} value={String(profile.rated_matches_count)} />
          <Stat
            label={t("detail.stats.last_match")}
            value={
              profile.days_since_last_match == null
                ? t("detail.stats.never")
                : profile.days_since_last_match <= 7
                  ? t("card.last_match_recent")
                  : t("card.last_match_days", { days: profile.days_since_last_match })
            }
          />
        </div>
      </section>

      {(() => {
        const recent = profile.recent_matches
          .filter((m) => m.won != null)
          .map((m) => (m.won ? "W" : "L") as "W" | "L");
        if (recent.length === 0) return null;
        return (
          <Surface variant="card" as="section">
            <RecentResultsStrip results={recent} take={5} />
          </Surface>
        );
      })()}

      {/* Schedule grid */}
      <Surface variant="card" as="section">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-grass-900">
          <CalendarClock className="h-4 w-4 text-grass-700" />
          {t("detail.schedule.title")}
        </h2>
        {profile.available_slots.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">{t("detail.schedule.empty")}</p>
        ) : (
          <div className="mt-3 grid gap-1 text-xs">
            <div
              className="grid items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500"
              style={{ gridTemplateColumns: `60px repeat(${TIME_SLOTS.length}, minmax(0,1fr))` }}
            >
              <span />
              {TIME_SLOTS.map((s) => (
                <span key={s} className="text-center">
                  {t(`daypart.${s}`)}
                </span>
              ))}
            </div>
            {WEEKDAYS.map((wd) => {
              const set = new Set(slotsByWeekday.get(wd) ?? []);
              return (
                <div
                  key={wd}
                  className="grid items-center gap-1"
                  style={{
                    gridTemplateColumns: `60px repeat(${TIME_SLOTS.length}, minmax(0,1fr))`,
                  }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-700">
                    {t(`weekday_short.${wd}`)}
                  </span>
                  {TIME_SLOTS.map((dp) => (
                    <span
                      key={dp}
                      className={"h-6 rounded-md " + (set.has(dp) ? "bg-grass-300" : "bg-ink-100")}
                      aria-label={set.has(dp) ? `${wd} ${dp}` : undefined}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Surface>

      {/* Recent matches */}
      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-grass-900">
          <Clock className="h-4 w-4 text-grass-700" />
          {t("detail.recent.title")}
        </h2>
        {profile.recent_matches.length === 0 ? (
          <EmptyState
            title={t("detail.recent.empty_title")}
            description={t("detail.recent.empty_body")}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {profile.recent_matches.map((m) => (
              <li key={m.id} className="surface-row lift-on-hover">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink-500">
                      {m.is_tournament
                        ? t("detail.recent.tournament_label")
                        : t("detail.recent.friendly_label")}
                      {m.is_doubles ? ` · ${t("detail.recent.doubles_label")}` : ""}
                    </p>
                    {m.tournament_name && (
                      <p className="text-xs text-ink-700">{m.tournament_name}</p>
                    )}
                    <p className="mt-1 text-sm text-ink-900">
                      <span className="text-ink-500">{t("detail.recent.vs")} </span>
                      {m.opponent.id ? (
                        <Link
                          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                          href={`/players/${m.opponent.id}` as any}
                          className="font-semibold text-ink-900 transition hover:text-grass-700"
                        >
                          {m.opponent.name ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-semibold">{m.opponent.name ?? "—"}</span>
                      )}
                    </p>
                    {(m.venue_name || m.venue_city) && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink-500">
                        <MapPin className="h-3 w-3" />
                        {[m.venue_name, m.venue_city].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {m.played_at && (
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {fmtDate.format(new Date(m.played_at))}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        "font-mono text-base font-bold tabular-nums " +
                        (m.won === true
                          ? "text-grass-700"
                          : m.won === false
                            ? "text-clay-700"
                            : "text-ink-500")
                      }
                    >
                      {m.score_for_player}
                    </p>
                    <p className="text-[10.5px] uppercase tracking-wider text-ink-500">
                      {m.won === true
                        ? t("detail.recent.result_win")
                        : m.won === false
                          ? t("detail.recent.result_loss")
                          : t("detail.recent.result_unknown")}
                    </p>
                  </div>
                </div>
                {m.is_doubles && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-ink-500">
                    <Users className="h-3 w-3" />
                    {t("detail.recent.doubles_label")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card">
      <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}
