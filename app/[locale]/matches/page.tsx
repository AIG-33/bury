import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Users,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Public matches feed.
//
// Lists every COMPLETED match — friendly + tournament — that is publicly
// shareable. Backed by the `public_matches_feed` SQL view, which:
//   * skips anything still in flight (proposed/scheduled/cancelled),
//   * skips matches in `privacy='club'` tournaments (the coach can flip
//     the tournament to `public` to publish results), and
//   * exposes only non-PII player fields (name + avatar + is_coach).
//
// We render a compact card per match: date · "P1 vs P2" · score · win badge,
// plus a tournament badge linking to /tournaments/{id} when applicable.
// Coaches' names link to their public profile (`/coaches/{id}`); non-coach
// player names render as plain text (we don't have a public per-player
// profile route yet — those exist only inside /coach/players for the
// owning coach).
// =============================================================================

const PAGE_SIZE = 30;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tournament?: string;
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
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();

  // Tournament dropdown options — only public tournaments since
  // anything else is filtered out of the feed anyway.
  const { data: tournamentRows } = (await supabase
    .from("tournaments")
    .select("id, name, starts_on")
    .eq("privacy", "public")
    .order("starts_on", { ascending: false })
    .limit(80)) as {
    data: Array<{ id: string; name: string; starts_on: string | null }> | null;
  };
  const tournaments = tournamentRows ?? [];

  let query = supabase
    .from("public_matches_feed")
    .select("*", { count: "exact" })
    .order("played_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (tournamentFilter) {
    query = query.eq("tournament_id", tournamentFilter);
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">
          {t("title")}
        </h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="public-matches"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <form
        action={`/${locale}/matches`}
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl2 border border-ink-100 bg-white px-4 py-3 shadow-card"
      >
        <label className="flex-1 min-w-[200px] text-xs font-medium text-ink-700">
          <span className="mb-1 block uppercase tracking-wider text-ink-500">
            {t("filter.tournament")}
          </span>
          <select
            name="tournament"
            defaultValue={tournamentFilter ?? ""}
            className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-500"
          >
            <option value="">{t("filter.all_tournaments")}</option>
            {tournaments.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg bg-grass-500 px-4 text-sm font-medium text-white transition hover:bg-grass-600"
        >
          {t("filter.apply")}
        </button>
        {(tournamentFilter || page > 1) && (
          <Link
            href="/matches"
            className="inline-flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            {t("filter.reset")}
          </Link>
        )}
        <span className="ml-auto text-xs text-ink-500">
          {t("count_summary", { count: totalCount })}
        </span>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <MatchRowItem
              key={m.id}
              m={m}
              dateFmt={dateFmt}
              labels={{
                tournament: t("badge.tournament"),
                friendly: t("badge.friendly"),
                doubles: t("badge.doubles"),
                tba: t("no_date"),
                vs: t("vs"),
                no_score: t("no_score"),
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
            href={buildPageHref(locale, page - 1, tournamentFilter)}
            label={t("pagination.prev")}
            iconLeading
          />
          <span className="text-xs text-ink-500">
            {t("pagination.page_of", { page, total: totalPages })}
          </span>
          <PaginationLink
            disabled={!hasNext}
            href={buildPageHref(locale, page + 1, tournamentFilter)}
            label={t("pagination.next")}
          />
        </nav>
      )}
    </div>
  );
}

function buildPageHref(
  locale: string,
  page: number,
  tournament: string | null,
): string {
  const sp = new URLSearchParams();
  if (tournament) sp.set("tournament", tournament);
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

function MatchRowItem({
  m,
  dateFmt,
  labels,
}: {
  m: MatchRow;
  dateFmt: Intl.DateTimeFormat;
  labels: {
    tournament: string;
    friendly: string;
    doubles: string;
    tba: string;
    vs: string;
    no_score: string;
  };
}) {
  const dateIso = m.played_at ?? m.scheduled_at;
  const dateLabel = dateIso ? dateFmt.format(new Date(dateIso)) : labels.tba;

  return (
    <li className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card transition hover:shadow-pop">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {dateLabel}
        </span>
        {m.tournament_id ? (
          <Link
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            href={`/tournaments/${m.tournament_id}` as any}
            className="inline-flex items-center gap-1 rounded-full bg-ball-50 px-2 py-0.5 text-[11px] font-medium text-ball-800 ring-1 ring-ball-200 transition hover:bg-ball-100"
          >
            <Trophy className="h-3 w-3" />
            {m.tournament_name ?? labels.tournament}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-grass-50 px-2 py-0.5 text-[11px] font-medium text-grass-700 ring-1 ring-grass-100">
            {labels.friendly}
          </span>
        )}
        {m.is_doubles && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-700">
            <Users className="h-3 w-3" />
            {labels.doubles}
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <PlayerSide
          id={m.p1_id}
          name={m.p1_name}
          avatar={m.p1_avatar}
          isCoach={m.p1_is_coach}
          partnerName={m.p1_partner_name}
          align="left"
          highlight={m.winner_side === "p1"}
        />
        <span className="text-center font-mono text-xs uppercase tracking-wider text-ink-400">
          {labels.vs}
        </span>
        <PlayerSide
          id={m.p2_id}
          name={m.p2_name}
          avatar={m.p2_avatar}
          isCoach={m.p2_is_coach}
          partnerName={m.p2_partner_name}
          align="right"
          highlight={m.winner_side === "p2"}
        />
      </div>

      <div className="mt-2 text-center font-mono text-sm tabular-nums text-ink-800">
        {m.sets && m.sets.length > 0 ? (
          m.sets.map((s, i) => {
            const tb =
              s.tiebreak_p1 != null && s.tiebreak_p2 != null
                ? `(${s.tiebreak_p1}–${s.tiebreak_p2})`
                : "";
            return (
              <span key={i} className="inline-block px-1">
                {s.p1_games}–{s.p2_games}
                {tb}
              </span>
            );
          })
        ) : (
          <span className="text-xs text-ink-400">{labels.no_score}</span>
        )}
      </div>
    </li>
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
}: {
  id: string;
  name: string | null;
  avatar: string | null;
  isCoach: boolean | null;
  partnerName: string | null;
  align: "left" | "right";
  highlight: boolean;
}) {
  const display = name ?? "—";
  const inner = (
    <span
      className={
        "inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition " +
        (highlight
          ? "bg-grass-50 text-grass-900 ring-1 ring-grass-200"
          : "text-ink-800")
      }
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="h-7 w-7 rounded-full object-cover"
        />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-700">
          {display.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span
          className={
            "block truncate font-medium " +
            (highlight ? "text-grass-900" : "text-ink-900")
          }
        >
          {display}
        </span>
        {partnerName && (
          <span className="block truncate text-[11px] text-ink-500">
            +&nbsp;{partnerName}
          </span>
        )}
      </span>
    </span>
  );

  const wrapper = isCoach ? (
    <Link
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      href={`/coaches/${id}` as any}
      className="inline-flex max-w-full hover:opacity-90"
    >
      {inner}
    </Link>
  ) : (
    inner
  );

  return (
    <div
      className={
        align === "right"
          ? "flex min-w-0 items-center justify-end"
          : "flex min-w-0 items-center justify-start"
      }
    >
      {wrapper}
    </div>
  );
}
