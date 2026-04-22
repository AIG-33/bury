import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ArrowLeft, CalendarDays, Clock, Coins, MapPin, Trophy, Eye } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { loadRoundRobinStandings, loadTournamentDetail } from "../actions";
import {
  ParticipantsSection,
  type ParticipantsCopy,
} from "./participants-section";
import { BracketSection, type BracketCopy } from "./bracket-section";
import { StandingsSection, type StandingsCopy } from "./standings-section";
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
  SURFACES,
  SEEDING_METHODS,
  MatchOutcomeInputs,
  type TournamentFormat,
  type TournamentStatus,
  type Surface,
  type SeedingMethod,
  type MatchOutcomeInput,
} from "@/lib/tournaments/schema";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function TournamentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsCoach");

  const result = await loadTournamentDetail(id);
  if (!result.ok) {
    if (result.error === "not_authenticated") {
      redirect(`/${locale}/login?next=/coach/tournaments/${id}`);
    }
    if (result.error === "not_found") notFound();
    if (result.error === "not_owner") redirect(`/${locale}/coach/tournaments`);
    redirect(`/${locale}/login`);
  }

  const { tournament, participants, matches, playerOptions } = result;

  const formatLabels = Object.fromEntries(
    TOURNAMENT_FORMATS.map((f) => [f, t(`formats.${f}`)]),
  ) as Record<TournamentFormat, string>;
  const statusLabels = Object.fromEntries(
    TOURNAMENT_STATUSES.map((s) => [s, t(`statuses.${s}`)]),
  ) as Record<TournamentStatus, string>;
  const surfaceLabels = Object.fromEntries(
    SURFACES.map((s) => [s, t(`surfaces.${s}`)]),
  ) as Record<Surface, string>;
  const drawMethodLabels = Object.fromEntries(
    SEEDING_METHODS.map((m) => [m, t(`draw_methods.${m}`)]),
  ) as Record<SeedingMethod, string>;
  const outcomeLabels = Object.fromEntries(
    MatchOutcomeInputs.map((o) => [o, t(`bracket.outcomes.${o}`)]),
  ) as Record<MatchOutcomeInput, string>;

  const participantsCopy: ParticipantsCopy = {
    title: t("participants.title"),
    add_placeholder: t("participants.add_placeholder"),
    add_button: t("participants.add_button"),
    adding: t("participants.adding"),
    empty: t("participants.empty"),
    remove: t("participants.remove"),
    remove_confirm: t("participants.remove_confirm"),
    seed_label: t("participants.seed_label"),
    no_seed: t("participants.no_seed"),
    withdrawn: t("participants.withdrawn"),
    no_options: t("participants.no_options"),
  };

  const bracketCopy: BracketCopy = {
    title: t("bracket.title"),
    generate: t("bracket.generate"),
    generating: t("bracket.generating"),
    regenerate_warning: t("bracket.regenerate_warning"),
    no_matches: t("bracket.no_matches"),
    not_supported: t("bracket.not_supported"),
    draw_method: t("bracket.draw_method"),
    draw_method_labels: drawMethodLabels,
    round: t("bracket.round"),
    bye: t("bracket.bye"),
    tbd: t("bracket.tbd"),
    edit_score: t("bracket.edit_score"),
    save: t("bracket.save"),
    saving: t("bracket.saving"),
    cancel: t("bracket.cancel"),
    outcome_label: t("bracket.outcome_label"),
    outcome_labels: outcomeLabels,
    add_set: t("bracket.add_set"),
    remove_set: t("bracket.remove_set"),
    set: t("bracket.set"),
    error: t("bracket.error"),
    insufficient_players: t("bracket.insufficient_players"),
  };

  const locked =
    tournament.status === "in_progress" || tournament.status === "finished";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={"/coach/tournaments" as any}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-3 w-3" /> {t("detail.back")}
        </Link>
      </div>

      <header className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-ink-900">
              {tournament.name}
            </h1>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-ink-600">
              <Trophy className="h-3.5 w-3.5" />
              {formatLabels[tournament.format]}
              {tournament.surface && ` · ${surfaceLabels[tournament.surface]}`}
            </p>
          </div>
          <span
            className={
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider " +
              (tournament.status === "draft"
                ? "bg-ink-100 text-ink-700"
                : tournament.status === "registration"
                  ? "bg-ball-100 text-ball-800"
                  : tournament.status === "in_progress"
                    ? "bg-grass-100 text-grass-800"
                    : tournament.status === "finished"
                      ? "bg-grass-200 text-grass-900"
                      : "bg-clay-100 text-clay-800")
            }
          >
            {statusLabels[tournament.status]}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {tournament.starts_on}
            {tournament.ends_on && tournament.ends_on !== tournament.starts_on
              ? ` → ${tournament.ends_on}`
              : ""}
          </span>
          {tournament.start_time && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" />
              {tournament.start_time.slice(0, 5)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Coins className="h-3 w-3" />
            {tournament.entry_fee_pln == null || tournament.entry_fee_pln === 0
              ? t("detail.entry_fee_free")
              : t("detail.entry_fee_pln", { n: tournament.entry_fee_pln })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {t(`privacy.${tournament.privacy}`)}
          </span>
        </div>

        {tournament.venues.length > 0 && (
          <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-600">
            {tournament.venues.map((v) => (
              <li
                key={v.id}
                className="inline-flex items-center gap-1 rounded-full bg-grass-50/60 px-2 py-0.5 text-grass-800"
              >
                <MapPin className="h-3 w-3" />
                {v.name}
                {v.city && <span className="text-ink-500">· {v.city}</span>}
              </li>
            ))}
          </ul>
        )}

        {tournament.description && (
          <p className="mt-3 text-sm text-ink-700">{tournament.description}</p>
        )}
      </header>

      <HelpPanel
        pageId="coach-tournament-detail"
        why={t("detail.help.why")}
        what={[
          t("detail.help.what.1"),
          t("detail.help.what.2"),
          t("detail.help.what.3"),
        ]}
        result={[t("detail.help.result.1"), t("detail.help.result.2")]}
      />

      <ParticipantsSection
        tournamentId={tournament.id}
        participants={participants}
        options={playerOptions}
        copy={participantsCopy}
        locked={locked}
      />

      <BracketSection
        tournamentId={tournament.id}
        matches={matches}
        copy={bracketCopy}
        participantsCount={participants.filter((p) => !p.withdrawn).length}
        initialMethod={tournament.draw_method ?? "rating"}
        format={tournament.format}
        matchRules={tournament.match_rules}
      />

      {tournament.format === "round_robin" && (
        <StandingsSection
          rows={await loadRoundRobinStandings(tournament.id)}
          copy={
            {
              title: t("standings.title"),
              empty: t("standings.empty"),
              col_pos: t("standings.col_pos"),
              col_player: t("standings.col_player"),
              col_played: t("standings.col_played"),
              col_wins: t("standings.col_wins"),
              col_losses: t("standings.col_losses"),
              col_sets: t("standings.col_sets"),
              col_games: t("standings.col_games"),
              col_elo: t("standings.col_elo"),
            } satisfies StandingsCopy
          }
        />
      )}
    </div>
  );
}
