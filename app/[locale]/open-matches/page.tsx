import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Link } from "@/i18n/routing";
import {
  Building2,
  CalendarClock,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Trophy,
  Users,
  UsersRound,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { BridgePanel } from "@/components/help/bridge-panel";
import { LevelBadge } from "@/components/rating/level-badge";
import { RatingDisplay } from "@/components/rating/rating-display";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCountryOptions, isValidCountryCode } from "@/lib/geo/countries";
import { loadOpenMatches } from "./actions";
import {
  OPEN_MATCH_LEVEL_BANDS,
  type OpenMatchLevelBand,
  type OpenMatchFormat,
} from "@/lib/open-matches/schema";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ format?: string; level?: string; venue?: string; country?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "openMatches" });
  return buildPageMetadata({
    locale,
    path: "/open-matches",
    title: t("title"),
    description: t("subtitle"),
  });
}

const FORMATS: OpenMatchFormat[] = ["singles", "doubles"];

export default async function OpenMatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("openMatches");
  const tLevels = await getTranslations("levels");
  const tBridges = await getTranslations("openMatches.bridges");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

  const rawCountry = sp.country?.trim().toUpperCase() ?? "";
  const country = isValidCountryCode(rawCountry) ? rawCountry : null;

  const filters = {
    format: FORMATS.includes(sp.format as OpenMatchFormat)
      ? (sp.format as OpenMatchFormat)
      : undefined,
    level_band: (OPEN_MATCH_LEVEL_BANDS as readonly string[]).includes(sp.level ?? "")
      ? (sp.level as OpenMatchLevelBand)
      : undefined,
    venue_id: sp.venue,
    country,
  };
  const countryOptions = getCountryOptions(locale);

  const [{ rows }, supabase] = await Promise.all([
    loadOpenMatches(filters),
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = user == null;

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: tCrumb("home"), path: "" },
          { name: tNav("sparrings"), path: "/open-matches" },
        ]}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="open-matches-list"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
        actions={
          <Button asChild variant="primary" size="sm">
            <Link
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              href={(isGuest ? "/login" : "/open-matches/new") as any}
            >
              <Plus className="h-4 w-4" />
              {isGuest ? t("guest_cta") : t("create_cta")}
            </Link>
          </Button>
        }
      />

      {/* Evergreen copy so an empty feed is not treated as a soft 404 by Google. */}
      <section className="space-y-3 rounded-2xl border border-grass-100 bg-grass-50/40 px-4 py-5 sm:px-5">
        <h2 className="font-display text-lg font-bold text-grass-900">{t("about.title")}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-ink-700">{t("about.body")}</p>
        <ol className="grid gap-2 text-sm text-ink-700 sm:grid-cols-3">
          <li className="rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-grass-100">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-grass-700">
              1
            </span>
            <p className="mt-1">{t("about.step_1")}</p>
          </li>
          <li className="rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-grass-100">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-grass-700">
              2
            </span>
            <p className="mt-1">{t("about.step_2")}</p>
          </li>
          <li className="rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-grass-100">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-grass-700">
              3
            </span>
            <p className="mt-1">{t("about.step_3")}</p>
          </li>
        </ol>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-ink-700">
            <span className="label-eyebrow mb-1 block">{t("filters.country_label")}</span>
            <select
              name="country"
              defaultValue={country ?? ""}
              className="w-48 rounded-[13px] border border-[rgba(20,60,30,0.12)] bg-[#FBFDF9] px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              <option value="">{t("filters.any_country")}</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary" size="sm">
            {t("filters.apply")}
          </Button>
        </form>
        <span className="text-sm text-ink-500">
          {t("filters.results_count", { count: rows.length })}
        </span>
      </div>

      <BridgePanel
        title={tBridges("title")}
        items={[
          ...(isGuest
            ? []
            : [
                {
                  href: "/me/find",
                  label: tBridges("to_finder_label"),
                  hint: tBridges("to_finder_hint"),
                  icon: SlidersHorizontal,
                },
              ]),
          {
            href: "/players",
            label: tBridges("to_players_label"),
            hint: tBridges("to_players_hint"),
            icon: UsersRound,
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description={t("empty_body")}
          ctaHref={isGuest ? `/${locale}/login` : `/${locale}/open-matches/new`}
          ctaLabel={isGuest ? t("guest_cta") : t("create_cta")}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => {
            const startsLabel = dateFmt.format(new Date(m.starts_at));
            const isAnyLevel = m.level_band === "any";
            return (
              <li
                key={m.id}
                className="surface-row lift-on-hover overflow-hidden p-0 md:p-0"
              >
                <Link
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  href={`/open-matches/${m.id}` as any}
                  className="block"
                >
                  {/* Looking-for banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grass-100 bg-grass-50/60 px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <Search className="h-4 w-4 text-grass-700" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-grass-800">
                        {t("looking_for")}
                      </span>
                      {!isAnyLevel ? (
                        <span className="inline-flex items-center rounded-full bg-grass-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                          {tLevels(m.level_band)}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-500">· {t("level_any")}</span>
                      )}
                    </span>
                    <span
                      className={
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                        (m.format === "singles"
                          ? "bg-grass-100 text-grass-800"
                          : "bg-ball-100 text-ink-800")
                      }
                    >
                      {t(m.format === "singles" ? "format_singles" : "format_doubles")}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
                      {m.creator_avatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={m.creator_avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Trophy className="h-6 w-6" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                          {t("host_label")}:
                        </span>
                        <span className="font-display text-base font-semibold text-ink-900">
                          {m.creator_name ?? "—"}
                        </span>
                        <RatingDisplay
                          internalElo={m.creator_elo}
                          internalStatus={
                            m.creator_elo_status === "provisional"
                              ? "provisional"
                              : "established"
                          }
                          external={
                            m.creator_external_rating
                              ? {
                                  source: "liga_tennisa",
                                  elo: m.creator_external_rating.external_elo,
                                  displayTier: m.creator_external_rating.display_tier,
                                  externalUrl: m.creator_external_rating.external_url,
                                  isCalibrating:
                                    m.creator_external_rating.is_calibrating_singles,
                                }
                              : null
                          }
                          variant="inline"
                          size="sm"
                        />
                        <LevelBadge elo={m.creator_elo} showRange={false} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 text-ink-400" />
                          {t("starts_at", { date: startsLabel })}
                          <span className="text-ink-400">·</span>
                          <span className="text-ink-500">
                            {t("duration_short", { min: m.duration_min })}
                          </span>
                        </span>
                        {m.venue_name ? (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-ink-400" />
                            {m.venue_name}
                            {m.venue_city && (
                              <span className="text-ink-400">· {m.venue_city}</span>
                            )}
                          </span>
                        ) : m.district_name ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-ink-400" />
                            {t("district_only", { name: m.district_name })}
                          </span>
                        ) : (
                          <span className="text-ink-400">{t("venue_unknown")}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {t("slots_short", { count: m.slots_needed })}
                        </span>
                        <span className="text-ink-300">·</span>
                        <span>
                          {t("applications_pending", { count: m.pending_applications_count })}
                        </span>
                      </div>

                      {m.notes && (
                        <p className="line-clamp-2 text-[13px] text-ink-600">{m.notes}</p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
