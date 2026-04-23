import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  MapPin,
  Search,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Public matches feed.
//
// Backed by the `public_matches_feed` SQL view (see
// supabase/migrations/20260423000000_public_matches_feed_with_venue.sql).
// The view exposes only PII-safe player data plus a resolved
// venue_id / venue_name so we can offer a venue filter without joins
// here.
//
// Filters supported:
//   * tournament    — exact tournament_id
//   * venue         — exact venue_id
//   * q             — case-insensitive ILIKE on either player's name
//
// Card design (2026-04-23): big, bold, modern. Tournament/Friendly/
// Doubles tags ride on top, players are larger and the score block uses
// tabular numbers in a chunky display font.
// =============================================================================

const PAGE_SIZE = 30;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tournament?: string;
    venue?: string;
    q?: string;
    page?: string;
  }>;
};

type MatchRow = {
  id: string;
  outcome: string;
  played_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  is_doubles: boolean;
  sets: Array<{
    p1_games: number;
    p2_games: number;
    tiebreak_p1?: number | null;
    tiebreak_p2?: number | null;
  }> | null;
  winner_side: "p1" | "p2" | null;
  p1_id: string;
  p1_name: string | null;
  p1_avatar: string | null;
  p1_is_coach: boolean | null;
  p1_partner_id: string | null;
  p1_partner_name: string | null;
  p2_id: string;
  p2_name: string | null;
  p2_avatar: string | null;
  p2_is_coach: boolean | null;
  p2_partner_id: string | null;
  p2_partner_name: string | null;
  tournament_id: string | null;
  tournament_name: string | null;
  tournament_surface: string | null;
  tournament_format: string | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_city: string | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "publicMatches" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: `/${locale}/matches`,
      languages: {
        pl: "/pl/matches",
        en: "/en/matches",
        ru: "/ru/matches",
      },
    },
  };
}

export default async function PublicMatchesPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("publicMatches");

  const tournamentFilter = sp.tournament?.trim() || null;
  const venueFilter = sp.venue?.trim() || null;
  const playerSearch = sp.q?.trim() || null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();

  // Tournament dropdown options — only public tournaments since
  // anything else is filtered out of the feed anyway.
  const [{ data: tournamentRows }, { data: venueRows }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, starts_on")
      .eq("privacy", "public")
      .order("starts_on", { ascending: false })
      .limit(80),
    supabase
      .from("venues")
      .select("id, name, city")
      .order("name", { ascending: true }),
  ]);
  const tournaments = (tournamentRows ?? []) as Array<{
    id: string;
    name: string;
    starts_on: string | null;
  }>;
  const venues = (venueRows ?? []) as Array<{
    id: string;
    name: string;
    city: string | null;
  }>;

  let query = supabase
    .from("public_matches_feed")
    .select("*", { count: "exact" })
    .order("played_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (tournamentFilter) {
    query = query.eq("tournament_id", tournamentFilter);
  }
  if (venueFilter) {
    query = query.eq("venue_id", venueFilter);
  }
  if (playerSearch) {
    // Match against either side; PostgREST `or` filter syntax.
    const escaped = playerSearch.replace(/[\\%_]/g, (m) => `\\${m}`);
    query = query.or(
      `p1_name.ilike.%${escaped}%,p2_name.ilike.%${escaped}%,p1_partner_name.ilike.%${escaped}%,p2_partner_name.ilike.%${escaped}%`,
    );
  }

  const { data: rawRows, count } = (await query) as {
    data: MatchRow[] | null;
    count: number | null;
  };
  const rows = rawRows ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  });

  const filtersActive = !!(tournamentFilter || venueFilter || playerSearch);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
            {t("title")}
          </h1>
          <HelpPanel
            pageId="public-matches"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <form
        action={`/${locale}/matches`}
        method="get"
        className="grid gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-4 shadow-card sm:grid-cols-[1fr_220px_220px_auto]"
      >
        <label className="block text-xs font-semibold text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filter.player")}
          </span>
          <span className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={playerSearch ?? ""}
              placeholder={t("filter.player_placeholder")}
              className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-100"
            />
          </span>
        </label>
        <label className="block text-xs font-semibold text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filter.tournament")}
          </span>
          <select
            name="tournament"
            defaultValue={tournamentFilter ?? ""}
            className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-500 focus:ring-2 focus:ring-grass-100"
          >
            <option value="">{t("filter.all_tournaments")}</option>
            {tournaments.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filter.venue")}
          </span>
          <select
            name="venue"
            defaultValue={venueFilter ?? ""}
            className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-500 focus:ring-2 focus:ring-grass-100"
          >
            <option value="">{t("filter.all_venues")}</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.city ? ` · ${v.city}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg bg-grass-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-grass-700"
          >
            {t("filter.apply")}
          </button>
          {(filtersActive || page > 1) && (
            <Link
              href="/matches"
              className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              {t("filter.reset")}
            </Link>
          )}
        </div>
        <div className="sm:col-span-4 flex items-center justify-between text-xs text-ink-500">
          <span>{t("count_summary", { count: totalCount })}</span>
          {filtersActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 font-medium text-ink-600">
              {t("filter.active")}
            </span>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyHowTo locale={locale} t={t} filtersActive={filtersActive} />
      ) : (
        <ul className="grid gap-3">
          {rows.map((m) => (
            <MatchRowItem
              key={m.id}
              m={m}
              locale={locale}
              dateFmt={dateFmt}
              labels={{
                tournament: t("badge.tournament"),
                friendly: t("badge.friendly"),
                doubles: t("badge.doubles"),
                tba: t("no_date"),
                no_score: t("no_score"),
                winner: t("winner"),
                set: t("set_short"),
              }}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          aria-label={t("pagination.aria")}
          className="flex items-center justify-between gap-3"
        >
          <PaginationLink
            disabled={!hasPrev}
            href={buildPageHref(locale, page - 1, {
              tournament: tournamentFilter,
              venue: venueFilter,
              q: playerSearch,
            })}
            label={t("pagination.prev")}
            iconLeading
          />
          <span className="text-xs text-ink-500">
            {t("pagination.page_of", { page, total: totalPages })}
          </span>
          <PaginationLink
            disabled={!hasNext}
            href={buildPageHref(locale, page + 1, {
              tournament: tournamentFilter,
              venue: venueFilter,
              q: playerSearch,
            })}
            label={t("pagination.next")}
          />
        </nav>
      )}
    </div>
  );
}

// Rich, actionable empty state. Same three pathways as before, plus a
// dedicated "filters too narrow" sub-state when the user just over-
// filtered.
function EmptyHowTo({
  locale,
  t,
  filtersActive,
}: {
  locale: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  filtersActive: boolean;
}) {
  const cards = [
    {
      icon: Send,
      title: t("empty.guide.friendly.title"),
      body: t("empty.guide.friendly.body"),
      href: `/${locale}/me/matches`,
      cta: t("empty.guide.friendly.cta"),
      tone: "grass" as const,
    },
    {
      icon: Trophy,
      title: t("empty.guide.tournament_score.title"),
      body: t("empty.guide.tournament_score.body"),
      href: `/${locale}/coach/tournaments`,
      cta: t("empty.guide.tournament_score.cta"),
      tone: "ball" as const,
    },
    {
      icon: Globe2,
      title: t("empty.guide.tournament_publish.title"),
      body: t("empty.guide.tournament_publish.body"),
      href: `/${locale}/coach/tournaments`,
      cta: t("empty.guide.tournament_publish.cta"),
      tone: "clay" as const,
    },
  ];

  const toneClasses: Record<
    "grass" | "ball" | "clay",
    { wrap: string; icon: string; cta: string }
  > = {
    grass: {
      wrap: "border-grass-200 bg-grass-50/40",
      icon: "bg-grass-100 text-grass-700",
      cta: "text-grass-800 hover:text-grass-900",
    },
    ball: {
      wrap: "border-ball-200 bg-ball-50/40",
      icon: "bg-ball-100 text-ball-700",
      cta: "text-ball-800 hover:text-ball-900",
    },
    clay: {
      wrap: "border-clay-200 bg-clay-50/40",
      icon: "bg-clay-100 text-clay-700",
      cta: "text-clay-800 hover:text-clay-900",
    },
  };

  return (
    <div className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-700">
          <Eye className="h-4 w-4" />
        </span>
        <div>
          <p className="font-display text-base font-bold text-ink-900">
            {filtersActive ? t("empty.filtered_title") : t("empty.title")}
          </p>
          <p className="text-sm text-ink-600">
            {filtersActive
              ? t("empty.filtered_description")
              : t("empty.description")}
          </p>
        </div>
      </div>

      {!filtersActive && (
        <div className="grid gap-3 md:grid-cols-3">
          {cards.map((c) => {
            const tone = toneClasses[c.tone];
            const Icon = c.icon;
            return (
              <a
                key={c.title}
                href={c.href}
                className={`group flex flex-col gap-2 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-pop ${tone.wrap}`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full ${tone.icon}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="font-display text-sm font-bold text-ink-900">
                  {c.title}
                </p>
                <p className="text-xs leading-snug text-ink-700">{c.body}</p>
                <span
                  className={`mt-auto inline-flex items-center gap-1 text-[12px] font-bold ${tone.cta}`}
                >
                  {c.cta}
                  <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function buildPageHref(
  locale: string,
  page: number,
  filters: {
    tournament: string | null;
    venue: string | null;
    q: string | null;
  },
): string {
  const sp = new URLSearchParams();
  if (filters.tournament) sp.set("tournament", filters.tournament);
  if (filters.venue) sp.set("venue", filters.venue);
  if (filters.q) sp.set("q", filters.q);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return `/${locale}/matches${qs ? `?${qs}` : ""}`;
}

function PaginationLink({
  disabled,
  href,
  label,
  iconLeading = false,
}: {
  disabled: boolean;
  href: string;
  label: string;
  iconLeading?: boolean;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-100 bg-ink-50/50 px-3 text-sm text-ink-400">
        {iconLeading && <ChevronLeft className="h-3.5 w-3.5" />}
        {label}
        {!iconLeading && <ChevronRight className="h-3.5 w-3.5" />}
      </span>
    );
  }
  return (
    <a
      href={href}
      className="inline-flex h-9 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
    >
      {iconLeading && <ChevronLeft className="h-3.5 w-3.5" />}
      {label}
      {!iconLeading && <ChevronRight className="h-3.5 w-3.5" />}
    </a>
  );
}

// =============================================================================
// Match card — bold, modern, large.
// =============================================================================
function MatchRowItem({
  m,
  locale,
  dateFmt,
  labels,
}: {
  m: MatchRow;
  locale: string;
  dateFmt: Intl.DateTimeFormat;
  labels: {
    tournament: string;
    friendly: string;
    doubles: string;
    tba: string;
    no_score: string;
    winner: string;
    set: string;
  };
}) {
  const dateIso = m.played_at ?? m.scheduled_at;
  const dateLabel = dateIso ? dateFmt.format(new Date(dateIso)) : labels.tba;

  // Header chip color: tournament = ball (yellow), friendly = grass.
  const isTournament = !!m.tournament_id;

  return (
    <li
      className={
        "group relative overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition hover:shadow-pop " +
        (isTournament ? "hover:border-ball-200" : "hover:border-grass-200")
      }
    >
      {/* Accent stripe by match type */}
      <span
        aria-hidden
        className={
          "absolute inset-y-0 left-0 w-1.5 " +
          (isTournament ? "bg-ball-400" : "bg-grass-400")
        }
      />

      <div className="space-y-3 p-5 pl-7">
        {/* Top row: meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-wider">
          <span className="inline-flex items-center gap-1 text-ink-500">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="text-ink-700">{dateLabel}</span>
          </span>
          {isTournament ? (
            <Link
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              href={`/tournaments/${m.tournament_id}` as any}
              className="inline-flex items-center gap-1 rounded-full bg-ball-100 px-2.5 py-1 text-ball-900 ring-1 ring-ball-200 transition hover:bg-ball-200"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span className="normal-case font-bold tracking-normal">
                {m.tournament_name ?? labels.tournament}
              </span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2.5 py-1 text-grass-900 ring-1 ring-grass-200">
              {labels.friendly}
            </span>
          )}
          {m.is_doubles && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-ink-700">
              <Users className="h-3.5 w-3.5" />
              {labels.doubles}
            </span>
          )}
          {m.venue_name && (
            <span className="inline-flex items-center gap-1 text-ink-500">
              <MapPin className="h-3.5 w-3.5" />
              <span className="normal-case font-medium tracking-normal text-ink-700">
                {m.venue_name}
                {m.venue_city ? ` · ${m.venue_city}` : ""}
              </span>
            </span>
          )}
        </div>

        {/* Players + score row */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <PlayerSide
            id={m.p1_id}
            name={m.p1_name}
            avatar={m.p1_avatar}
            isCoach={m.p1_is_coach}
            partnerName={m.p1_partner_name}
            align="left"
            highlight={m.winner_side === "p1"}
            winnerLabel={labels.winner}
            locale={locale}
          />

          <ScoreBlock
            sets={m.sets}
            winnerSide={m.winner_side}
            noScoreLabel={labels.no_score}
            setLabel={labels.set}
          />

          <PlayerSide
            id={m.p2_id}
            name={m.p2_name}
            avatar={m.p2_avatar}
            isCoach={m.p2_is_coach}
            partnerName={m.p2_partner_name}
            align="right"
            highlight={m.winner_side === "p2"}
            winnerLabel={labels.winner}
            locale={locale}
          />
        </div>
      </div>
    </li>
  );
}

function ScoreBlock({
  sets,
  winnerSide,
  noScoreLabel,
  setLabel,
}: {
  sets: MatchRow["sets"];
  winnerSide: "p1" | "p2" | null;
  noScoreLabel: string;
  setLabel: string;
}) {
  if (!sets || sets.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs font-medium text-ink-400">
        {noScoreLabel}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center">
      <div className="inline-grid grid-flow-col auto-cols-fr gap-3 rounded-xl bg-ink-50 px-4 py-3">
        {sets.map((s, i) => {
          const p1Win = s.p1_games > s.p2_games;
          const p2Win = s.p2_games > s.p1_games;
          return (
            <div key={i} className="flex flex-col items-center">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                {setLabel}&nbsp;{i + 1}
              </span>
              <div className="mt-0.5 grid grid-cols-2 gap-x-2 font-display text-2xl font-extrabold tabular-nums leading-none">
                <span
                  className={
                    p1Win
                      ? "text-grass-700"
                      : winnerSide === "p1"
                      ? "text-ink-800"
                      : "text-ink-400"
                  }
                >
                  {s.p1_games}
                  {s.tiebreak_p1 != null && (
                    <sup className="ml-0.5 text-[10px] font-bold">
                      {s.tiebreak_p1}
                    </sup>
                  )}
                </span>
                <span
                  className={
                    p2Win
                      ? "text-grass-700"
                      : winnerSide === "p2"
                      ? "text-ink-800"
                      : "text-ink-400"
                  }
                >
                  {s.p2_games}
                  {s.tiebreak_p2 != null && (
                    <sup className="ml-0.5 text-[10px] font-bold">
                      {s.tiebreak_p2}
                    </sup>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerSide({
  id,
  name,
  avatar,
  isCoach,
  partnerName,
  align,
  highlight,
  winnerLabel,
  locale,
}: {
  id: string;
  name: string | null;
  avatar: string | null;
  isCoach: boolean | null;
  partnerName: string | null;
  align: "left" | "right";
  highlight: boolean;
  winnerLabel: string;
  locale: string;
}) {
  const display = name ?? "—";
  const initial = display.slice(0, 1).toUpperCase();

  const avatarBlock = avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatar}
      alt=""
      className={
        "h-11 w-11 rounded-full object-cover ring-2 transition " +
        (highlight ? "ring-grass-400" : "ring-white")
      }
    />
  ) : (
    <span
      className={
        "grid h-11 w-11 place-items-center rounded-full font-display text-base font-bold ring-2 transition " +
        (highlight
          ? "bg-grass-100 text-grass-900 ring-grass-400"
          : "bg-ink-100 text-ink-700 ring-white")
      }
    >
      {initial}
    </span>
  );

  const nameBlock = (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5">
        <span
          className={
            "block truncate font-display text-base font-bold leading-tight " +
            (highlight ? "text-grass-900" : "text-ink-900")
          }
        >
          {display}
        </span>
        {highlight && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-grass-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
            <Trophy className="h-2.5 w-2.5" />
            {winnerLabel}
          </span>
        )}
      </span>
      {partnerName && (
        <span className="block truncate text-xs font-medium text-ink-500">
          + {partnerName}
        </span>
      )}
    </span>
  );

  const inner = (
    <span
      className={
        "flex items-center gap-3 rounded-xl px-2 py-1 " +
        (align === "right" ? "flex-row-reverse text-right" : "text-left")
      }
    >
      {avatarBlock}
      {nameBlock}
    </span>
  );

  if (isCoach) {
    return (
      <Link
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        href={`/coaches/${id}` as any}
        className={
          "min-w-0 transition hover:opacity-90 " +
          (align === "right" ? "justify-self-end" : "justify-self-start")
        }
      >
        {inner}
      </Link>
    );
  }
  // Suppress unused locale (kept for future per-player profile route).
  void locale;
  return (
    <div
      className={
        "min-w-0 " +
        (align === "right" ? "justify-self-end" : "justify-self-start")
      }
    >
      {inner}
    </div>
  );
}
