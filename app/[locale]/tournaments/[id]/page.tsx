import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildTournamentEventJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Calendar,
  Clock,
  Coins,
  MapPin,
  Users,
  Trophy,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { TournamentRoomHero, shouldRenderHero } from "@/components/domain/tournament-room-hero";
import { buildRoomTheme } from "@/lib/tournaments/branding";
import { RatingDisplay } from "@/components/rating/rating-display";
import { MatchScorecard, type ScorecardSet } from "@/components/match/match-scorecard";
import { Surface } from "@/components/ui/surface";
import { Chip } from "@/components/ui/surface";
import { TournamentStatusPill } from "@/components/domain/tournament-status-pill";
import { loadPublicTournamentDetail } from "../actions";
import { loadTournamentViewerState } from "@/app/[locale]/(player)/me/tournaments/actions";
import { TournamentApplyButton, type ApplyButtonCopy } from "./apply-button";

type Props = { params: Promise<{ locale: string; id: string }> };

const tournamentIdSchema = z.string().uuid();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const detail = await loadPublicTournamentDetail(id);
  if (!detail) return { title: "Tournament", robots: { index: false } };
  const description =
    detail.tournament.description ??
    `${detail.tournament.format} · ${detail.tournament.participants_count} participants`;
  return buildPageMetadata({
    locale,
    path: `/tournaments/${id}`,
    title: detail.tournament.name,
    description,
    ogType: "article",
  });
}

export default async function PublicTournamentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsPublic");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

  if (!tournamentIdSchema.safeParse(id).success) notFound();

  const [detail, viewer] = await Promise.all([
    loadPublicTournamentDetail(id),
    loadTournamentViewerState(id),
  ]);
  if (!detail) {
    // RLS hides non-public tournaments from anonymous visitors, so a shared
    // registration link used to dead-end in a 404. Send guests through login
    // and bounce them back here (post-login honours the locale-less `next`).
    if (!viewer.authenticated) {
      redirect(`/${locale}/login?next=${encodeURIComponent(`/tournaments/${id}`)}`);
    }
    notFound();
  }

  const { tournament, participants, matches } = detail;

  const applyCopy: ApplyButtonCopy = {
    title: t("detail.apply.title"),
    cta: t("detail.apply.cta"),
    applying: t("detail.apply.applying"),
    login_cta: t("detail.apply.login_cta"),
    login_hint: t("detail.apply.login_hint"),
    closed: t("detail.apply.closed"),
    owner: t("detail.apply.owner"),
    pending: t("detail.apply.pending"),
    approved: t("detail.apply.approved"),
    rejected: t("detail.apply.rejected"),
  };
  const fmtDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
  });

  const city = tournament.venues[0]?.city ?? null;
  const jsonLd = buildTournamentEventJsonLd({
    id,
    locale,
    name: tournament.name,
    description: tournament.description,
    startsOn: tournament.starts_on,
    startTime: tournament.start_time,
    city,
    status: tournament.status,
  });

  const theme = buildRoomTheme(tournament.branding);
  const branded = shouldRenderHero(tournament.branding);
  const accent = theme.accentColor;
  const helpPanel = (
    <HelpPanel
      pageId="public-tournament-detail"
      variant="inline"
      why={t("detail.help.why")}
      what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
      result={[t("detail.help.result.1")]}
    />
  );

  return (
    <div style={theme.themed ? theme.backgroundStyle : undefined}>
      <JsonLdScript data={jsonLd} />

      {branded && (
        <TournamentRoomHero
          branding={tournament.branding}
          fallbackTitle={tournament.name}
          sponsorsLabel={t("detail.sponsors")}
          help={helpPanel}
        />
      )}

      <div className="page-shell space-y-6">
        <Breadcrumbs
          locale={locale}
          items={[
            { name: tCrumb("home"), path: "" },
            { name: tNav("tournaments"), path: "/tournaments" },
            { name: tournament.name, path: `/tournaments/${id}` },
          ]}
        />
        <Link
          href={`/${locale}/tournaments`}
          className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        {!branded && (
          <PageHeader
            title={tournament.name}
            subtitle={tournament.description ?? undefined}
            help={helpPanel}
          />
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          <Chip tone="grass" className="uppercase">
            {t(`format.${tournament.format}`)}
          </Chip>
          {tournament.surface && (
            <Chip tone="clay" className="uppercase">
              {t(`surfaces.${tournament.surface}`)}
            </Chip>
          )}
          <TournamentStatusPill
            status={tournament.status}
            label={t(`status.${tournament.status}`)}
          />
        </div>

        {/* Meta strip */}
        <dl className="grid gap-4 sm:grid-cols-3">
          <Surface variant="row">
            <dt className="label-eyebrow">{t("detail.starts")}</dt>
            <dd className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink-900">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4 text-grass-700" />
                {fmtDate.format(new Date(tournament.starts_on))}
              </span>
              {tournament.start_time && (
                <span className="inline-flex items-center gap-1 text-sm tabular-nums text-ink-700">
                  <Clock className="h-3.5 w-3.5 text-grass-700" />
                  {tournament.start_time.slice(0, 5)}
                </span>
              )}
            </dd>
          </Surface>
          <Surface variant="row">
            <dt className="label-eyebrow">{t("detail.participants")}</dt>
            <dd className="mt-1 inline-flex items-center gap-1 font-medium text-ink-900">
              <Users className="h-4 w-4 text-grass-700" />
              {tournament.participants_count}
              {tournament.max_participants ? ` / ${tournament.max_participants}` : ""}
            </dd>
          </Surface>
          <Surface variant="row">
            <dt className="label-eyebrow">{t("detail.entry_fee")}</dt>
            <dd className="mt-1 inline-flex items-center gap-1 font-medium tabular-nums text-ink-900">
              <Coins className="h-4 w-4 text-grass-700" />
              {tournament.entry_fee_byn == null || tournament.entry_fee_byn === 0
                ? t("entry_fee_free")
                : t("entry_fee_byn", { n: tournament.entry_fee_byn })}
            </dd>
          </Surface>
          <Surface variant="row">
            <dt className="label-eyebrow">{t("detail.organizer")}</dt>
            <dd className="mt-1 inline-flex items-center gap-1 font-medium text-ink-900">
              <Trophy className="h-4 w-4 text-grass-700" />
              {tournament.organizer_name ?? "—"}
            </dd>
          </Surface>
          {tournament.venues.length > 0 && (
            <Surface variant="row" className="sm:col-span-2">
              <dt className="label-eyebrow">{t("detail.venues")}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-900">
                {tournament.venues.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1 rounded-full bg-grass-50 px-2 py-0.5 text-xs text-grass-700"
                  >
                    <MapPin className="h-3 w-3" />
                    {v.name}
                    {v.city && <span className="text-ink-500">· {v.city}</span>}
                  </span>
                ))}
              </dd>
            </Surface>
          )}
        </dl>

        {/* Apply — the CTA the shareable registration link lands on. */}
        <Surface variant="card" as="section">
          <h2 className="section-title mb-3 text-[18px] md:text-[20px]">
            <span
              className="inline-block pb-0.5"
              style={accent ? { borderBottom: `2px solid ${accent}` } : undefined}
            >
              {applyCopy.title}
            </span>
          </h2>
          <TournamentApplyButton
            locale={locale}
            tournamentId={id}
            status={tournament.status}
            viewer={viewer}
            copy={applyCopy}
          />
        </Surface>

        {/* Participants */}
        <Surface variant="card" as="section">
          <h2 className="section-title mb-3 text-[18px] md:text-[20px]">
            {t("detail.participants_title")}
          </h2>
          {participants.length === 0 ? (
            <p className="text-sm text-ink-500">{t("detail.participants_empty")}</p>
          ) : (
            <ol className="grid gap-1 sm:grid-cols-2">
              {participants
                .filter((p) => !p.withdrawn)
                .map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm odd:bg-ink-50/50"
                  >
                    <span className="text-ink-700">
                      <span className="mr-2 font-mono text-xs tabular-nums text-ink-400">
                        {p.seed ?? i + 1}.
                      </span>
                      {p.name ?? "?"}
                    </span>
                    <RatingDisplay
                      internalElo={p.elo}
                      external={
                        p.external_rating
                          ? {
                              source: "liga_tennisa",
                              elo: p.external_rating.external_elo,
                              displayTier: p.external_rating.display_tier,
                              externalUrl: p.external_rating.external_url,
                              isCalibrating: p.external_rating.is_calibrating_singles,
                            }
                          : null
                      }
                      variant="inline"
                      size="sm"
                    />
                  </li>
                ))}
            </ol>
          )}
        </Surface>

        {/* Matches — same scorecard look as /matches; grouped by round so a
          long bracket reads top → down by stage. */}
        <Surface variant="card" as="section">
          <h2 className="section-title mb-3 text-[18px] md:text-[20px]">
            {t("detail.matches_title")}
          </h2>
          {matches.length === 0 ? (
            <p className="text-sm text-ink-500">{t("detail.matches_empty")}</p>
          ) : (
            <TournamentMatchesByRound
              matches={matches}
              locale={locale}
              labels={{
                round_short: t("detail.round_short"),
                scheduled: t("detail.scheduled"),
                winner: t("detail.winner"),
                countLabel: (n: number) => t("detail.matches_count", { n }),
                tba: t("detail.tba"),
              }}
            />
          )}
        </Surface>
      </div>
    </div>
  );
}

// =============================================================================
// Tournament-page rendering of matches.
//
// Same compact scorecard as /matches (shared component), wrapped in a
// per-round <details> shutter so the bracket reads stage-by-stage.
// =============================================================================
function TournamentMatchesByRound({
  matches,
  locale,
  labels,
}: {
  matches: NonNullable<Awaited<ReturnType<typeof loadPublicTournamentDetail>>>["matches"];
  locale: string;
  labels: {
    round_short: string;
    scheduled: string;
    winner: string;
    /** Renders e.g. "9 матчей" with proper plural form. */
    countLabel: (n: number) => string;
    tba: string;
  };
}) {
  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Minsk",
  });

  // Preserve the upstream order (round asc, bracket_slot asc).
  const order: Array<number | "_no_round"> = [];
  const groups = new Map<number | "_no_round", { matches: typeof matches }>();
  for (const m of matches) {
    const k: number | "_no_round" = m.round ?? "_no_round";
    if (!groups.has(k)) {
      order.push(k);
      groups.set(k, { matches: [] });
    }
    groups.get(k)!.matches.push(m);
  }

  // All rounds collapsed by default — user picks the round they care
  // about. Keeps the initial bracket index compact.
  return (
    <div className="space-y-2">
      {order.map((roundKey) => {
        const g = groups.get(roundKey)!;
        const headerLabel =
          roundKey === "_no_round" ? labels.tba : `${labels.round_short}${roundKey}`;

        return (
          <details
            key={String(roundKey)}
            open={false}
            className="group/g rounded-2xl border border-ball-100 bg-white shadow-[0_4px_18px_-14px_rgba(15,27,20,0.1)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-3 py-2 transition hover:bg-ink-50/60 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ball-100 font-mono text-[10px] font-bold text-ball-800">
                  {roundKey === "_no_round" ? "—" : roundKey}
                </span>
                <span className="truncate font-display text-[14px] font-bold text-ball-900">
                  {headerLabel}
                </span>
                <span className="shrink-0 rounded-full bg-ink-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-600">
                  {labels.countLabel(g.matches.length)}
                </span>
              </div>
            </summary>

            <ul className="grid gap-2 px-3 pb-3 md:grid-cols-2">
              {g.matches.map((m) => {
                const dateIso = m.played_at ?? m.scheduled_at;
                const sets: ScorecardSet[][] = (m.sets ?? []).reduce(
                  (acc: ScorecardSet[][], s) => {
                    acc[0].push({
                      my: s.p1,
                      their: s.p2,
                      tb: s.tb_p1 ?? null,
                    });
                    acc[1].push({
                      my: s.p2,
                      their: s.p1,
                      tb: s.tb_p2 ?? null,
                    });
                    return acc;
                  },
                  [[], []],
                );

                return (
                  <MatchScorecard
                    key={m.id}
                    accent="tournament"
                    winnerLabel={labels.winner}
                    noScoreLabel={m.outcome === "scheduled" ? labels.scheduled : "—"}
                    meta={
                      <>
                        {dateIso ? (
                          <span className="inline-flex items-center gap-1 text-ink-500">
                            <CalendarDays className="h-3 w-3" />
                            <span className="normal-case tracking-normal text-ink-700">
                              {dateFmt.format(new Date(dateIso))}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-ink-600">
                            {labels.tba}
                          </span>
                        )}
                      </>
                    }
                    p1={{
                      id: m.p1_id,
                      name: m.p1_name,
                      avatarUrl: m.p1_avatar,
                      isCoach: m.p1_is_coach,
                      isWinner: m.winner_id != null && m.winner_id === m.p1_id,
                      sets: sets[0],
                    }}
                    p2={{
                      id: m.p2_id,
                      name: m.p2_name,
                      avatarUrl: m.p2_avatar,
                      isCoach: m.p2_is_coach,
                      isWinner: m.winner_id != null && m.winner_id === m.p2_id,
                      sets: sets[1],
                    }}
                  />
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
