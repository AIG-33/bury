import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Clock,
  Minus,
  Sparkles,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { loadMyRatingTab, type RatingMatchRow } from "@/lib/rating/history";
import { PageHeader } from "@/components/layout/page-header";
import { EloChart } from "./elo-chart";

type Props = { params: Promise<{ locale: string }> };

export default async function MyRatingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("rating");

  const data = await loadMyRatingTab();
  if (!data) redirect(`/${locale}/login`);

  const { hero, history, season, recentMatches, needs_onboarding_quiz } = data;
  const deltaPositive = hero.delta_30d >= 0;

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

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

      {/* My recent matches with Elo deltas */}
      <section className="surface-card">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {t("matches.title")}
          </h2>
          <p className="text-xs text-ink-500">
            {t("matches.subtitle", { n: recentMatches.length })}
          </p>
        </div>

        {recentMatches.length === 0 ? (
          <EmptyState
            title={t("matches.empty_title")}
            description={t("matches.empty_description")}
          />
        ) : (
          <ul className="space-y-2">
            {recentMatches.map((m) => (
              <MatchListRow
                key={m.id}
                m={m}
                copy={{
                  won: t("matches.won"),
                  lost: t("matches.lost"),
                  cancelled: t("matches.cancelled"),
                  no_change: t("matches.no_change"),
                  new_elo_label: t("matches.new_elo_label"),
                  tournament_generic: t("matches.tournament_generic"),
                }}
                dateFmt={dateFmt}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// =============================================================================
// Internal components
// =============================================================================

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

function MatchListRow({
  m,
  copy,
  dateFmt,
}: {
  m: RatingMatchRow;
  copy: {
    won: string;
    lost: string;
    cancelled: string;
    no_change: string;
    new_elo_label: string;
    tournament_generic: string;
  };
  dateFmt: Intl.DateTimeFormat;
}) {
  const won = m.i_am_winner === true;
  const lost = m.i_am_winner === false;
  const isCancelled = m.outcome === "cancelled";

  // Per-set scores from the viewer's perspective (you – them).
  const setStrings = (m.sets ?? []).map((s) => {
    const my = m.is_p1 ? s.p1_games : s.p2_games;
    const their = m.is_p1 ? s.p2_games : s.p1_games;
    const myTb = m.is_p1 ? s.tiebreak_p1 : s.tiebreak_p2;
    const theirTb = m.is_p1 ? s.tiebreak_p2 : s.tiebreak_p1;
    const wonSet = my > their;
    return { my, their, myTb, theirTb, wonSet };
  });

  return (
    <li className="relative overflow-hidden rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Avatar */}
        <Avatar url={m.opponent.avatar_url} name={m.opponent.display_name ?? "?"} />

        {/* Opponent + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-semibold text-ink-900">
              {m.opponent.display_name ?? "—"}
            </p>
            <span className="font-mono text-xs tabular-nums text-ink-500">
              {m.opponent.current_elo}
            </span>

            {isCancelled ? (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                {copy.cancelled}
              </span>
            ) : won ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-[11px] font-semibold text-grass-800">
                <Trophy className="h-3 w-3" />
                {copy.won}
              </span>
            ) : lost ? (
              <span className="rounded-full bg-clay-50 px-2 py-0.5 text-[11px] font-semibold text-clay-700">
                {copy.lost}
              </span>
            ) : null}

            {m.tournament_id && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ball-50 px-2 py-0.5 text-[11px] font-medium text-ball-800 ring-1 ring-ball-200">
                <Trophy className="h-3 w-3" />
                {m.tournament_name ?? copy.tournament_generic}
              </span>
            )}
          </div>

          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
            <Clock className="h-3 w-3" />
            {dateFmt.format(new Date(m.played_at))}
          </p>

          {setStrings.length > 0 && (
            <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 font-mono text-sm tabular-nums text-ink-800">
              {setStrings.map((s, i) => (
                <span
                  key={i}
                  className={
                    s.wonSet
                      ? won
                        ? "font-semibold text-grass-700"
                        : "font-semibold text-ink-800"
                      : "text-ink-500"
                  }
                >
                  {s.my}–{s.their}
                  {s.myTb != null && s.theirTb != null
                    ? `(${s.myTb}\u2013${s.theirTb})`
                    : ""}
                </span>
              ))}
            </p>
          )}
        </div>

        {/* Elo change block */}
        <EloChange
          delta={m.delta}
          newElo={m.new_elo}
          noChangeLabel={copy.no_change}
          newEloLabel={copy.new_elo_label}
        />
      </div>
    </li>
  );
}

function EloChange({
  delta,
  newElo,
  noChangeLabel,
  newEloLabel,
}: {
  delta: number | null;
  newElo: number | null;
  noChangeLabel: string;
  newEloLabel: string;
}) {
  if (delta == null || newElo == null) {
    return (
      <div className="flex shrink-0 flex-col items-end">
        <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-1 font-mono text-xs text-ink-500">
          <Minus className="h-3 w-3" />
          {noChangeLabel}
        </span>
      </div>
    );
  }

  const positive = delta > 0;
  const zero = delta === 0;
  const cls = zero
    ? "bg-ink-50 text-ink-700 ring-ink-200"
    : positive
      ? "bg-grass-50 text-grass-800 ring-grass-200"
      : "bg-clay-50 text-clay-800 ring-clay-200";

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-sm font-bold tabular-nums ring-1 ${cls}`}
      >
        {zero ? (
          <Minus className="h-3.5 w-3.5" />
        ) : positive ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )}
        {positive ? `+${delta}` : delta}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-ink-500">
        {newEloLabel} {newElo}
      </span>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-ink-100" />;
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-100 font-display text-sm font-bold text-grass-700 ring-1 ring-grass-200">
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
