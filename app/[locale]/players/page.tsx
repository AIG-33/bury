import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Award, Clock, Hand, LogIn, MapPin, Sparkles, Trophy } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { GuestNextStepBanner } from "@/components/landing/guest-next-step-banner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadPublicDistrictOptions,
  loadPublicPlayers,
  LEVEL_BUCKETS,
  type LevelBucket,
} from "./actions";
import { TIME_SLOTS, WEEKDAYS } from "@/lib/profile/schema";

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
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/players`,
      languages: { ru: "/ru/players", en: "/en/players" },
    },
  };
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
  // weekday and daypart are paired filters — only apply when both are picked.
  const slotApplied = Boolean(weekday) && Boolean(daypart);

  const [{ results, total, truncated }, districts, sessionUser] = await Promise.all([
    loadPublicPlayers({
      level,
      districtId: districtId || undefined,
      hand,
      weekday: slotApplied ? weekday : "",
      daypart: slotApplied ? daypart : "",
    }),
    loadPublicDistrictOptions(),
    (async () => {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    })(),
  ]);

  const isGuest = !sessionUser;
  const hasFilter = level !== "any" || Boolean(districtId) || hand !== "both" || slotApplied;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
          <HelpPanel
            pageId="players-public"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <GuestNextStepBanner isGuest={isGuest} current="players" />

      {/* Filter bar — URL-driven so SSR & shareable links work. */}
      <form
        action={`/${locale}/players`}
        method="get"
        className="grid gap-3 rounded-xl2 border border-ink-100 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="text-xs font-medium text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
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
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
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
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
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
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
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
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
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
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white transition hover:bg-grass-600"
          >
            {t("controls.apply")}
          </button>
          {hasFilter && (
            <Link
              href="/players"
              className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
            >
              {t("controls.reset")}
            </Link>
          )}
        </div>
      </form>

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
            ctaLabel={isGuest ? t("guest_banner.cta") : undefined}
            ctaHref={isGuest ? `/${locale}/login` : undefined}
          />
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <li
              key={p.id}
              className="flex flex-col rounded-xl2 border border-ink-100 bg-white p-4 shadow-card transition hover:shadow-ace"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
                  {p.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Trophy className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    href={`/players/${p.id}` as any}
                    className="truncate font-display text-base font-semibold text-ink-900 transition hover:text-grass-700"
                  >
                    {p.display_name ?? "—"}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    {(p.city || p.district_name) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[p.city, p.district_name].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {p.is_coach && (
                      <Link
                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                        href={`/coaches/${p.id}` as any}
                        title={t("card.is_coach_hint")}
                        className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-semibold text-grass-700 hover:bg-grass-200"
                      >
                        <Award className="h-3 w-3" />
                        {t("card.is_coach")}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-semibold tabular-nums text-grass-800">
                    {p.elo_status === "established"
                      ? t("card.elo_established", { elo: p.current_elo })
                      : t("card.elo_provisional", { elo: p.current_elo })}
                  </p>
                  <p className="text-[10.5px] text-ink-500">
                    {t("card.rated_matches", { count: p.rated_matches_count })}
                  </p>
                </div>
              </div>

              {/* Sport prefs */}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-700">
                {p.dominant_hand && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5">
                    <Hand className="h-3 w-3" />
                    {t(`card.hand_${p.dominant_hand}`)}
                    {p.backhand_style && (
                      <span className="text-ink-500">
                        {" · "}
                        {t(`card.backhand_${p.backhand_style === "one_handed" ? "one" : "two"}`)}
                      </span>
                    )}
                  </span>
                )}
                {p.external_rating && (
                  <a
                    href={p.external_rating.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-ball-300 bg-ball-50 px-2 py-0.5 font-mono text-ball-800 hover:bg-ball-100"
                    title="Liga Tennisa"
                  >
                    LT · {p.external_rating.display_tier}
                  </a>
                )}
              </div>

              {/* Recency / availability summary */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {p.days_since_last_match == null
                    ? t("card.last_match_never")
                    : p.days_since_last_match <= 7
                      ? t("card.last_match_recent")
                      : t("card.last_match_days", { days: p.days_since_last_match })}
                </span>
                <span>{t("card.available_summary", { count: p.available_slots.length })}</span>
              </div>

              <div className="mt-auto pt-4">
                {isGuest ? (
                  <Link
                    href={{
                      pathname: "/login",
                      query: { next: `/me/find?focus=${p.id}` },
                    }}
                    className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-grass-700 px-3 text-sm font-semibold text-white transition hover:bg-grass-800"
                  >
                    <LogIn className="h-4 w-4" />
                    {t("card.propose_login")}
                  </Link>
                ) : (
                  <Link
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    href={`/me/find?focus=${p.id}` as any}
                    className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-grass-500 px-3 text-sm font-semibold text-white transition hover:bg-grass-600"
                  >
                    {t("card.propose_login")}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
