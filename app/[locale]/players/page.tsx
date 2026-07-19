import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Link } from "@/i18n/routing";
import { Award, CalendarClock, Clock, Hand, MapPin, Sparkles, Trophy } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { LevelBadge } from "@/components/rating/level-badge";
import { RatingDisplay } from "@/components/rating/rating-display";
import { WinRatePill } from "@/components/rating/win-rate-pill";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPublicDistrictOptions, loadPublicPlayers } from "./actions";
import { LEVEL_BUCKETS, type LevelBucket } from "./filters";
import { TIME_SLOTS, WEEKDAYS } from "@/lib/profile/schema";
import { loadPrimaryClubsForUsers } from "@/lib/clubs/primary";
import { PrimaryClubBadge } from "@/components/clubs/primary-club-badge";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    level?: string;
    district?: string;
    hand?: string;
    weekday?: string;
    daypart?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "playersPublic" });
  return buildPageMetadata({
    locale,
    path: "/players",
    title: t("title"),
    description: t("subtitle"),
  });
}

function isLevelBucket(v: string | undefined): v is LevelBucket {
  return !!v && (LEVEL_BUCKETS as readonly string[]).includes(v);
}

export default async function PublicPlayersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("playersPublic");

  const level: LevelBucket = isLevelBucket(sp.level) ? sp.level : "any";
  const districtId = sp.district ?? "";
  const hand = sp.hand === "R" || sp.hand === "L" || sp.hand === "both" ? sp.hand : "both";
  const weekday = (WEEKDAYS as readonly string[]).includes(sp.weekday ?? "")
    ? (sp.weekday as (typeof WEEKDAYS)[number])
    : "";
  const daypart = (TIME_SLOTS as readonly string[]).includes(sp.daypart ?? "")
    ? (sp.daypart as (typeof TIME_SLOTS)[number])
    : "";
  const slotApplied = Boolean(weekday) && Boolean(daypart);

  const supabase = await createSupabaseServerClient();
  const [{ results, total, truncated }, districts, authRes] = await Promise.all([
    loadPublicPlayers({
      level,
      districtId: districtId || undefined,
      hand,
      weekday: slotApplied ? weekday : "",
      daypart: slotApplied ? daypart : "",
    }),
    loadPublicDistrictOptions(),
    supabase.auth.getUser(),
  ]);
  const user = authRes.data.user;
  const isGuest = user == null;

  const hasFilter = level !== "any" || Boolean(districtId) || hand !== "both" || slotApplied;

  const primaryClubByUserId = await (async () => {
    if (results.length === 0) return new Map<string, never>();
    return loadPrimaryClubsForUsers(
      supabase,
      results.map((p) => p.id),
    );
  })();

  return (
    <div className="page-shell-wide space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="players-public"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      {/* Filter bar — URL-driven so SSR & shareable links work. */}
      <Surface variant="flat">
        <form
          action={`/${locale}/players`}
          method="get"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block label-eyebrow">
              {t("controls.level_label")}
            </span>
            <select
              name="level"
              defaultValue={level}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              {LEVEL_BUCKETS.map((b) => (
                <option key={b} value={b}>
                  {t(`controls.level.${b}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block label-eyebrow">
              {t("controls.district")}
            </span>
            <select
              name="district"
              defaultValue={districtId}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              <option value="">{t("controls.any_district")}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.city} · {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block label-eyebrow">
              {t("controls.hand")}
            </span>
            <select
              name="hand"
              defaultValue={hand}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              {(["both", "R", "L"] as const).map((h) => (
                <option key={h} value={h}>
                  {t(`controls.hand_options.${h}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block label-eyebrow">
              {t("controls.weekday")}
            </span>
            <select
              name="weekday"
              defaultValue={weekday}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              <option value="">{t("controls.any_weekday")}</option>
              {WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {t(`weekday.${d}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink-700">
            <span className="mb-1 block label-eyebrow">
              {t("controls.daypart")}
            </span>
            <select
              name="daypart"
              defaultValue={daypart}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            >
              <option value="">{t("controls.any_daypart")}</option>
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {t(`daypart.${s}`)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
            <Button type="submit" variant="primary" size="sm">
              {t("controls.apply")}
            </Button>
            {hasFilter && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/players">
                  {t("controls.reset")}
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Surface>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
        <span className="font-mono tabular-nums">{t("results.showing", { count: total })}</span>
        {truncated && (
          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
            <Sparkles className="h-3.5 w-3.5" />
            {t("results.truncated")}
          </span>
        )}
      </div>

      {results.length === 0 ? (
        hasFilter ? (
          <EmptyState
            title={t("empty_title")}
            description={t("empty_body")}
            ctaLabel={t("controls.reset")}
            ctaHref={`/${locale}/players`}
          />
        ) : (
          <EmptyState
            title={t("no_filter_empty_title")}
            description={t("no_filter_empty_body")}
          />
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => {
            const isProvisional = p.elo_status !== "established";
            const locationParts = [p.city, p.district_name].filter(Boolean) as string[];
            return (
              <li
                key={p.id}
                className="surface-row lift-on-hover group relative flex flex-col gap-4"
              >
                {/* Header: avatar + name on the left, big Elo on the right. */}
                <div className="flex items-start gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800 ring-1 ring-grass-200/60">
                    {p.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Trophy className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <Link
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      href={`/players/${p.id}` as any}
                      className="block truncate font-display text-[17px] font-semibold leading-tight text-ink-900 transition hover:text-grass-700"
                      title={p.display_name ?? undefined}
                    >
                      {p.display_name ?? "—"}
                    </Link>
                    {locationParts.length > 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{locationParts.join(" · ")}</span>
                      </p>
                    )}
                    {primaryClubByUserId.get(p.id) && (
                      <div className="mt-1.5">
                        <PrimaryClubBadge
                          slug={primaryClubByUserId.get(p.id)!.slug}
                          name={primaryClubByUserId.get(p.id)!.name}
                          logoUrl={primaryClubByUserId.get(p.id)!.logo_url}
                        />
                      </div>
                    )}
                    {p.is_coach && (
                      <Link
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        href={`/coaches/${p.id}` as any}
                        title={t("card.is_coach_hint")}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-grass-700 transition hover:bg-grass-200"
                      >
                        <Award className="h-3 w-3" />
                        {t("card.is_coach")}
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <RatingDisplay
                      internalElo={p.current_elo}
                      external={
                        p.external_rating
                          ? {
                              source: "liga_tennisa",
                              elo: p.external_rating.external_elo,
                              displayTier: p.external_rating.display_tier,
                              externalUrl: p.external_rating.external_url,
                            }
                          : null
                      }
                      variant="stacked"
                      size="md"
                    />
                    <LevelBadge elo={p.current_elo} showRange={false} />
                    {isProvisional && (
                      <span
                        title={t("card.status_provisional_hint")}
                        className="inline-flex items-center rounded-full bg-ball-100 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-800"
                      >
                        {t("card.status_provisional_label")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Style + matches pills. */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-700">
                  <WinRatePill wins={p.stats.wins_count} losses={p.stats.losses_count} />
                  <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 tabular-nums">
                    {t("card.matches_short", { count: p.rated_matches_count })}
                  </span>
                  {p.dominant_hand && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5">
                      <Hand className="h-3 w-3" />
                      {t(`card.hand_${p.dominant_hand}`)}
                      {p.backhand_style && (
                        <>
                          <span className="text-ink-400">·</span>
                          <span className="text-ink-600">
                            {t(`card.backhand_${p.backhand_style === "one_handed" ? "one" : "two"}`)}
                          </span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Activity row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {p.days_since_last_match == null
                      ? t("card.last_match_never")
                      : p.days_since_last_match <= 7
                        ? t("card.last_match_recent")
                        : t("card.last_match_days", { days: p.days_since_last_match })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {t("card.available_summary", { count: p.available_slots.length })}
                  </span>
                </div>

                <div className="mt-auto pt-1">
                  <Button asChild variant="primary" className="w-full justify-center">
                    <Link
                      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                      href={
                        (isGuest
                          ? `/login?next=/${locale}/me/find?focus=${p.id}`
                          : `/me/find?focus=${p.id}`) as any
                      }
                    >
                      {t("card.propose_login")}
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
