import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Trophy,
  Star,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadMyRatingTab } from "@/lib/rating/history";
import { PageHeader } from "@/components/layout/page-header";
import { EloChart } from "./elo-chart";

type Props = { params: Promise<{ locale: string }> };

export default async function MyRatingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("rating");

  const data = await loadMyRatingTab();
  if (!data) redirect(`/${locale}/login`);

  const { hero, history, season, topCoaches, needs_onboarding_quiz } = data;
  const deltaPositive = hero.delta_30d >= 0;

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Player · Rating"
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="me-rating"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      {needs_onboarding_quiz && (
        <section
          aria-live="polite"
          className="relative overflow-hidden rounded-2xl border-2 border-ball-400 bg-gradient-to-br from-ball-50 via-white to-grass-50 p-5 shadow-[0_18px_48px_-18px_rgba(234,179,8,0.45)] sm:p-6"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-ball-200/60 blur-2xl"
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ball-500 text-white shadow-[0_10px_24px_-10px_rgba(234,179,8,0.9)]">
                <Sparkles className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="label-eyebrow text-ball-700">
                  {t("quiz_cta.eyebrow")}
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-ink-900 sm:text-2xl">
                  {t("quiz_cta.title")}
                </h2>
                <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-700">
                  {t("quiz_cta.body")}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-ink-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-grass-600" />
                    {t("quiz_cta.bullet1")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-grass-600" />
                    {t("quiz_cta.bullet2")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-grass-600" />
                    {t("quiz_cta.bullet3")}
                  </li>
                </ul>
              </div>
            </div>

            <Link
              href={`/${locale}/onboarding/quiz`}
              className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 self-stretch rounded-full bg-grass-700 px-6 font-mono text-[12.5px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_18px_40px_-16px_rgba(21,94,54,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-grass-800 sm:self-auto"
            >
              {t("quiz_cta.cta")}
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </section>
      )}

      {/* Hero: current Elo */}
      <section className="surface-card overflow-hidden bg-gradient-to-br from-grass-50 via-white to-white">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label-eyebrow">{t("hero.label")}</p>
            <p className="mt-2 inline-flex items-center gap-4 font-display text-6xl font-extrabold tabular-nums text-grass-900 md:text-7xl">
              <Trophy className="h-12 w-12 text-ball-500 drop-shadow-[0_4px_12px_rgba(31,138,76,0.25)]" />
              {hero.current_elo}
            </p>
            <p className="mt-3 text-[15px] text-ink-600">
              {t(`hero.status.${hero.elo_status}`)} ·{" "}
              {t("hero.matches", { n: hero.rated_matches_count })}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat
              label={t("hero.delta_30d")}
              value={`${deltaPositive ? "+" : ""}${hero.delta_30d}`}
              accent={
                hero.delta_30d === 0
                  ? "neutral"
                  : deltaPositive
                    ? "positive"
                    : "negative"
              }
              icon={
                hero.delta_30d === 0 ? null : deltaPositive ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )
              }
            />
            <Stat label={t("hero.best")} value={hero.best_elo.toString()} />
            <Stat label={t("hero.worst")} value={hero.worst_elo.toString()} />
          </div>
        </div>
      </section>

      {/* Season race + chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="surface-card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {t("history.title")}
            </h2>
            <span className="text-xs text-ink-500">
              {t("history.last_n", { n: history.length })}
            </span>
          </div>
          <EloChart
            history={history}
            locale={locale as "pl" | "en" | "ru"}
            copy={{
              empty: t("history.empty"),
              elo_axis: t("history.axis"),
              delta: t("history.delta_label"),
              reason_match: t("history.reasons.match"),
              reason_onboarding: t("history.reasons.onboarding"),
              reason_manual: t("history.reasons.manual_adjustment"),
              reason_decay: t("history.reasons.seasonal_decay"),
            }}
          />
        </section>

        <section className="surface-card overflow-hidden bg-gradient-to-br from-ball-50 via-white to-white">
          <div className="mb-2 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-ball-700" />
            <h2 className="font-display text-lg font-semibold text-ink-900">
              {t("race.title")}
            </h2>
          </div>
          {season ? (
            <>
              <p className="text-sm font-medium text-ink-800">{season.name}</p>
              <p className="mt-1 text-xs text-ink-500">
                {new Date(season.starts_on).toLocaleDateString(locale)} →{" "}
                {new Date(season.ends_on).toLocaleDateString(locale)}
              </p>
              <div className="mt-4 rounded-lg bg-white p-3 ring-1 ring-ball-200">
                <p className="text-xs uppercase tracking-wide text-ink-500">
                  {t("race.days_left")}
                </p>
                <p className="font-mono text-3xl font-bold text-ball-700">
                  {season.days_left}
                </p>
              </div>
              {season.prizes_description && (
                <p className="mt-3 text-xs text-ink-700">
                  <span className="font-semibold">{t("race.prizes")}:</span>{" "}
                  {season.prizes_description}
                </p>
              )}
              <p className="mt-3 text-[11px] text-ink-500">
                {t("race.coming_soon")}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-500">{t("race.no_season")}</p>
          )}
        </section>
      </div>

      {/* Top coaches placeholder */}
      <section className="surface-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {t("coaches.title")}
          </h2>
          <span className="text-xs text-ink-500">{t("coaches.subtitle")}</span>
        </div>
        {topCoaches.length === 0 ? (
          <EmptyState
            title={t("coaches.empty_title")}
            description={t("coaches.empty_description")}
          />
        ) : (
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {topCoaches.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">
                  {i + 1}
                </span>
                <CoachAvatar url={c.avatar_url} name={c.display_name ?? "?"} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {c.display_name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {c.city ?? "—"}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-md bg-ball-50 px-2 py-0.5 text-xs font-semibold text-ball-800">
                  <Star className="h-3 w-3 fill-ball-500 text-ball-500" />
                  {c.coach_avg_rating?.toFixed(2) ?? "—"}
                  <span className="text-ink-500">
                    ({c.coach_reviews_count})
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "neutral",
  icon = null,
}: {
  label: string;
  value: string;
  accent?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}) {
  const color =
    accent === "positive"
      ? "text-grass-700"
      : accent === "negative"
        ? "text-clay-700"
        : "text-ink-800";
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-grass-100">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <p
        className={`mt-0.5 inline-flex items-center gap-1 font-mono text-xl font-bold tabular-nums ${color}`}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

function CoachAvatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-grass-100 text-xs font-bold text-grass-700">
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
