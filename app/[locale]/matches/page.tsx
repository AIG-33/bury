import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  Handshake,
  MapPin,
  Search,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { MatchScorecard, type ScorecardSet } from "@/components/match/match-scorecard";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Public matches feed.
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
        ru: "/ru/matches",
        en: "/en/matches",
      },
    },
  };
}

export default async function PublicMatchesPage({ params, searchParams }: Props) {
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

  const [{ data: tournamentRows }, { data: venueRows }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, starts_on")
      .eq("privacy", "public")
      .order("starts_on", { ascending: false })
      .limit(80),
    supabase.from("venues").select("id, name, city").order("name", { ascending: true }),
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
    timeZone: "Europe/Minsk",
  });

  const filtersActive = !!(tournamentFilter || venueFilter || playerSearch);

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="public-matches"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <Surface variant="flat">
        <form
          action={`/${locale}/matches`}
          method="get"
          className="grid gap-3 sm:grid-cols-[1fr_220px_220px_auto]"
        >
          <label className="block text-xs font-semibold text-ink-700">
            <span className="mb-1 block label-eyebrow">
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
            <span className="mb-1 block label-eyebrow">
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
            <span className="mb-1 block label-eyebrow">
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
            <Button type="submit" variant="primary" size="sm">
              {t("filter.apply")}
            </Button>
            {(filtersActive || page > 1) && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/matches">
                  {t("filter.reset")}
                </Link>
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-ink-500 sm:col-span-4">
            <span>{t("count_summary", { count: totalCount })}</span>
            {filtersActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 font-medium text-ink-600">
                {t("filter.active")}
              </span>
            )}
          </div>
        </form>
      </Surface>

      {rows.length === 0 ? (
        <EmptyHowTo locale={locale} t={t} filtersActive={filtersActive} />
      ) : (
        <MatchGroups
          rows={rows}
          locale={locale}
          dateFmt={dateFmt}
          labels={{
            tournament: t("badge.tournament"),
            friendly: t("badge.friendly"),
            friendly_group: t("group.friendly"),
            countLabel: (n: number) => t("group.count", { n }),
            open_tournament: t("group.open_tournament"),
            doubles: t("badge.doubles"),
            tba: t("no_date"),
            no_score: t("no_score"),
            winner: t("winner"),
            set: t("set_short"),
          }}
        />
      )}

      {totalPages > 1 && (
        <nav aria-label={t("pagination.aria")} className="flex items-center justify-between gap-3">
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
    <Surface variant="card" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-700">
          <Eye className="h-4 w-4" />
        </span>
        <div>
          <p className="font-display text-base font-bold text-ink-900">
            {filtersActive ? t("empty.filtered_title") : t("empty.title")}
          </p>
          <p className="text-sm text-ink-600">
            {filtersActive ? t("empty.filtered_description") : t("empty.description")}
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
                className={`group lift-on-hover flex flex-col gap-2 rounded-2xl border p-4 ${tone.wrap}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full ${tone.icon}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <p className="font-display text-sm font-bold text-ink-900">{c.title}</p>
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
    </Surface>
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
// Group matches by tournament (friendly matches → "Товарищеские" group).
// Each group is a native <details> shutter — accessible, no JS needed,
// preserved across navigation by the browser when set as default-open.
// =============================================================================

type GroupKey = string; // tournament_id or the sentinel "_friendly"

type GroupLabels = {
  tournament: string;
  friendly: string;
  friendly_group: string;
  /** Renders e.g. "9 матчей" with proper plural form. */
  countLabel: (n: number) => string;
  open_tournament: string;
  doubles: string;
  tba: string;
  no_score: string;
  winner: string;
  set: string;
};

function MatchGroups({
  rows,
  locale,
  dateFmt,
  labels,
}: {
  rows: MatchRow[];
  locale: string;
  dateFmt: Intl.DateTimeFormat;
  labels: GroupLabels;
}) {
  // Group preserving the chronological order of `rows` (already sorted DESC
  // by played_at on the server). Earliest-touched groups render first —
  // this matches what the user expects ("recent tournament on top").
  const groupOrder: GroupKey[] = [];
  const groups = new Map<
    GroupKey,
    { key: GroupKey; tournamentId: string | null; name: string; matches: MatchRow[] }
  >();
  for (const row of rows) {
    const key: GroupKey = row.tournament_id ?? "_friendly";
    if (!groups.has(key)) {
      groupOrder.push(key);
      groups.set(key, {
        key,
        tournamentId: row.tournament_id,
        name: row.tournament_id
          ? row.tournament_name ?? labels.tournament
          : labels.friendly_group,
        matches: [],
      });
    }
    groups.get(key)!.matches.push(row);
  }

  // Default-open behaviour:
  //   - the first group on the page (most recent activity)
  //   - any small group (≤ 4 matches) so short groups don't hide
  // The user can collapse / expand others freely.
  return (
    <div className="space-y-3">
      {groupOrder.map((key, index) => {
        const g = groups.get(key)!;
        const isFriendly = key === "_friendly";
        const defaultOpen = index === 0 || g.matches.length <= 4;

        return (
          <details
            key={key}
            open={defaultOpen}
            className={
              "group/g rounded-xl3 border bg-white shadow-[0_8px_30px_-22px_rgba(15,27,20,0.08)] " +
              (isFriendly ? "border-grass-100" : "border-ball-100")
            }
          >
            <summary
              className={
                "flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl3 px-4 py-3 transition hover:bg-ink-50/60 " +
                "[&::-webkit-details-marker]:hidden"
              }
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <ChevronDown
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-ink-500 transition-transform duration-200 group-open/g:rotate-0 -rotate-90"
                />
                <span
                  className={
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full " +
                    (isFriendly
                      ? "bg-grass-100 text-grass-700"
                      : "bg-ball-100 text-ball-700")
                  }
                  aria-hidden
                >
                  {isFriendly ? (
                    <Handshake className="h-3.5 w-3.5" />
                  ) : (
                    <Trophy className="h-3.5 w-3.5" />
                  )}
                </span>
                <span
                  className={
                    "truncate font-display text-[15px] font-bold " +
                    (isFriendly ? "text-grass-900" : "text-ball-900")
                  }
                  title={g.name}
                >
                  {g.name}
                </span>
                <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-600">
                  {labels.countLabel(g.matches.length)}
                </span>
              </div>

              {!isFriendly && g.tournamentId && (
                <Link
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  href={`/tournaments/${g.tournamentId}` as any}
                  // Click bubbles up and toggles the <details> too, but
                  // navigation wins (the page changes), so the toggle is
                  // not visible. Avoiding onClick keeps this a pure server
                  // component (Server Components can't pass functions as
                  // props to Client Components like <Link>).
                  className="hidden shrink-0 items-center gap-1 rounded-full border border-ball-200 bg-white px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ball-800 hover:bg-ball-50 sm:inline-flex"
                >
                  {labels.open_tournament}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </summary>

            <ul className="grid gap-3 px-4 pb-4 md:grid-cols-2">
              {g.matches.map((m) => (
                <MatchRowItem
                  key={m.id}
                  m={m}
                  locale={locale}
                  dateFmt={dateFmt}
                  hideTournamentBadge
                  labels={labels}
                />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

// =============================================================================
// Adapter: turns a MatchRow from `public_matches_feed` into the props the
// shared <MatchScorecard> expects. Visual logic lives in the component;
// this function only shapes data + builds the meta chips for this page.
// =============================================================================
function MatchRowItem({
  m,
  locale,
  dateFmt,
  labels,
  hideTournamentBadge = false,
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
  /** True when the card is rendered inside a tournament group — the group
   *  header already shows the tournament name, so we don't repeat it. */
  hideTournamentBadge?: boolean;
}) {
  void locale;
  const dateIso = m.played_at ?? m.scheduled_at;
  const dateLabel = dateIso ? dateFmt.format(new Date(dateIso)) : labels.tba;
  const isTournament = !!m.tournament_id;
  const sets = m.sets ?? [];

  // Per-side set arrays (the shared component is side-agnostic).
  const p1Sets: ScorecardSet[] = sets.map((s) => ({
    my: s.p1_games,
    their: s.p2_games,
    tb: s.tiebreak_p1 ?? null,
  }));
  const p2Sets: ScorecardSet[] = sets.map((s) => ({
    my: s.p2_games,
    their: s.p1_games,
    tb: s.tiebreak_p2 ?? null,
  }));

  const meta = (
    <>
      <span className="inline-flex items-center gap-1 text-ink-500">
        <CalendarDays className="h-3 w-3" />
        <span className="text-ink-700 normal-case tracking-normal">{dateLabel}</span>
      </span>
      {!hideTournamentBadge && isTournament && (
        <Link
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          href={`/tournaments/${m.tournament_id}` as any}
          className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full bg-ball-100 px-2 py-0.5 text-ball-900 ring-1 ring-ball-200 transition hover:bg-ball-200"
        >
          <Trophy className="h-3 w-3 shrink-0" />
          <span className="truncate font-bold normal-case tracking-normal">
            {m.tournament_name ?? labels.tournament}
          </span>
        </Link>
      )}
      {!hideTournamentBadge && !isTournament && (
        <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-grass-900 ring-1 ring-grass-200">
          {labels.friendly}
        </span>
      )}
      {m.is_doubles && (
        <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-ink-700">
          <Users className="h-3 w-3" />
          {labels.doubles}
        </span>
      )}
      {m.venue_name && (
        <span className="inline-flex min-w-0 items-center gap-1 text-ink-500">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate font-medium normal-case tracking-normal text-ink-700">
            {m.venue_name}
            {m.venue_city ? ` · ${m.venue_city}` : ""}
          </span>
        </span>
      )}
    </>
  );

  return (
    <MatchScorecard
      accent={isTournament ? "tournament" : "friendly"}
      meta={meta}
      noScoreLabel={labels.no_score}
      winnerLabel={labels.winner}
      p1={{
        id: m.p1_id,
        name: m.p1_name,
        avatarUrl: m.p1_avatar,
        isCoach: m.p1_is_coach,
        partnerName: m.p1_partner_name,
        isWinner: m.winner_side === "p1",
        sets: p1Sets,
      }}
      p2={{
        id: m.p2_id,
        name: m.p2_name,
        avatarUrl: m.p2_avatar,
        isCoach: m.p2_is_coach,
        partnerName: m.p2_partner_name,
        isWinner: m.winner_side === "p2",
        sets: p2Sets,
      }}
    />
  );
}
