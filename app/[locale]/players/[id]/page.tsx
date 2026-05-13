import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Award, CalendarClock, Clock, Hand, MapPin, Trophy, Users } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { GuestProposeLink } from "@/components/analytics/guest-propose-link";
import { LevelBadge } from "@/components/rating/level-badge";
import { WinRatePill } from "@/components/rating/win-rate-pill";
import { RecentResultsStrip } from "@/components/rating/recent-results-strip";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPublicPlayerProfile } from "../actions";
import { TIME_SLOTS, WEEKDAYS } from "@/lib/profile/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
      robots: { index: false },
    };
  }
  const t = await getTranslations({ locale, namespace: "playersPublic" });
  return {
    title: profile.display_name ?? t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/players/${id}`,
      languages: {
        ru: `/ru/players/${id}`,
        en: `/en/players/${id}`,
      },
    },
  };
}

export default async function PublicPlayerProfilePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("playersPublic");

  const [profile, sessionUser] = await Promise.all([
    loadPublicPlayerProfile(id),
    (async () => {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    })(),
  ]);
  if (!profile) notFound();

  const isGuest = !sessionUser;
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  // Build a {weekday → list of dayparts} map to render the schedule grid.
  const slotsByWeekday = new Map<string, string[]>();
  for (const s of profile.available_slots) {
    const arr = slotsByWeekday.get(s.weekday) ?? [];
    arr.push(s.daypart);
    slotsByWeekday.set(s.weekday, arr);
  }

  const jsonLd = buildPlayerJsonLd(profile, locale);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
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

      <header className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
          {profile.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Trophy className="h-7 w-7" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-2xl font-bold text-ink-900">
              {profile.display_name ?? "—"}
            </h1>
            <HelpPanel
              pageId={`player-detail-${profile.id}`}
              variant="inline"
              why={t("detail.help.why")}
              what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
              result={[t("detail.help.result.1"), t("detail.help.result.2")]}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-600">
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
            {profile.is_coach && (
              <Link
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                href={`/coaches/${profile.id}` as any}
                className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-xs font-semibold text-grass-700 hover:bg-grass-200"
              >
                <Award className="h-3 w-3" />
                {t("card.is_coach")}
              </Link>
            )}
            {profile.external_rating && (
              <a
                href={profile.external_rating.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-ball-300 bg-ball-50 px-2 py-0.5 font-mono text-xs text-ball-800 hover:bg-ball-100"
                title="Liga Tennisa"
              >
                LT · {profile.external_rating.display_tier}
              </a>
            )}
          </div>
        </div>
        <div className="ml-auto">
          {isGuest ? (
            <GuestProposeLink
              playerId={profile.id}
              label={t("card.propose_login")}
              surface="player_profile"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-700 px-4 text-sm font-semibold text-white transition hover:bg-grass-800"
            />
          ) : (
            <Link
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              href={`/me/find?focus=${profile.id}` as any}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600"
            >
              {t("card.propose_login")}
            </Link>
          )}
        </div>
      </header>

      {/* Stats trio */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      </section>

      {/* Recent W/L strip — derived from `recent_matches` (newest first). The
          strip is rendered only when there's at least one decided match; the
          component itself returns null on empty input so we don't double-guard. */}
      {(() => {
        const recent = profile.recent_matches
          .filter((m) => m.won != null)
          .map((m) => (m.won ? "W" : "L") as "W" | "L");
        if (recent.length === 0) return null;
        return (
          <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
            <RecentResultsStrip results={recent} take={5} />
          </section>
        );
      })()}

      {/* Schedule grid */}
      <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink-900">
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
      </section>

      {/* Recent matches */}
      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink-900">
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
              <li key={m.id} className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}
