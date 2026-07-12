import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ArrowLeft, CalendarDays, Clock, Coins, MapPin, Trophy, Eye } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Chip } from "@/components/ui/surface";
import {
  loadGroupStandings,
  loadRoundRobinStandings,
  loadTournamentDetail,
  loadVenueOptions,
  loadAdministrableClubs,
} from "../actions";
import { buildTournamentDialogCopy } from "../dialog-copy";
import { ParticipantsSection, type ParticipantsCopy } from "./participants-section";
import { BracketSection, type BracketCopy } from "./bracket-section";
import { GroupsSection, type GroupsCopy } from "./groups-section";
import { StandingsSection, type StandingsCopy } from "./standings-section";
import { PrivacyControl, type PrivacyControlCopy } from "./privacy-control";
import { StatusControl, type StatusControlCopy } from "./status-control";
import { EditTournamentButton } from "./edit-tournament-button";
import { RegistrationLink, type RegistrationLinkCopy } from "./registration-link";
import { TournamentBrandingSection } from "./branding-section";
import { loadTournamentBranding } from "../branding-actions";
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
  SURFACES,
  SEEDING_METHODS,
  MatchOutcomeInputs,
  type TournamentFormat,
  type TournamentStatus,
  type Surface as CourtSurface,
  type SeedingMethod,
  type MatchOutcomeInput,
} from "@/lib/tournaments/schema";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function OrganizedTournamentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsOrganized");

  const [result, venueOptions, clubOptions, branding] = await Promise.all([
    loadTournamentDetail(id),
    loadVenueOptions(),
    loadAdministrableClubs(),
    loadTournamentBranding(id),
  ]);
  if (!result.ok) {
    if (result.error === "not_authenticated") {
      redirect(`/${locale}/login?next=/me/tournaments/organized/${id}`);
    }
    if (result.error === "not_found") notFound();
    if (result.error === "not_owner") redirect(`/${locale}/me/tournaments/organized`);
    redirect(`/${locale}/login`);
  }

  const { tournament, participants, matches, playerOptions, groups } = result;

  const formatLabels = Object.fromEntries(
    TOURNAMENT_FORMATS.map((f) => [f, t(`formats.${f}`)]),
  ) as Record<TournamentFormat, string>;
  const statusLabels = Object.fromEntries(
    TOURNAMENT_STATUSES.map((s) => [s, t(`statuses.${s}`)]),
  ) as Record<TournamentStatus, string>;
  const surfaceLabels = Object.fromEntries(SURFACES.map((s) => [s, t(`surfaces.${s}`)])) as Record<
    CourtSurface,
    string
  >;
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
    pending_section: t("participants.pending_section"),
    approved_section: t("participants.approved_section"),
    rejected_section: t("participants.rejected_section"),
    pending_empty: t("participants.pending_empty"),
    rejected_empty: t("participants.rejected_empty"),
    approve: t("participants.approve"),
    reject: t("participants.reject"),
    reject_confirm: t("participants.reject_confirm"),
    approving: t("participants.approving"),
    rejecting: t("participants.rejecting"),
    reapprove: t("participants.reapprove"),
    add_directly_hint: t("participants.add_directly_hint"),
  };

  const bracketCopy: BracketCopy = {
    title: t("bracket.title"),
    playoff_title: t("bracket.playoff_title"),
    playoff_pending: t("bracket.playoff_pending"),
    third_place_label: t("bracket.third_place_label"),
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
    quick_scores: t("bracket.quick_scores"),
    special_result: t("bracket.special_result"),
    error: t("bracket.error"),
    insufficient_players: t("bracket.insufficient_players"),
  };

  const groupsCopy: GroupsCopy = {
    title: t("groups.title"),
    setup_help: t("groups.setup_help"),
    groups_count_label: t("groups.groups_count_label"),
    method_label: t("groups.method_label"),
    method_labels: drawMethodLabels,
    generate: t("groups.generate"),
    generating: t("groups.generating"),
    regenerate_warning: t("groups.regenerate_warning"),
    not_enough_players: t("groups.not_enough_players"),
    empty: t("groups.empty"),
    group_label: t("groups.group_label", { name: "{name}" }),
    move_to: t("groups.move_to"),
    cannot_move_after_start: t("groups.cannot_move_after_start"),
    member_count: t("groups.member_count"),
    roster: t("groups.roster"),
    matches: t("groups.matches"),
    no_matches: t("groups.no_matches"),
    standings: t("groups.standings"),
    col_pos: t("standings.col_pos"),
    col_player: t("standings.col_player"),
    col_played: t("standings.col_played"),
    col_wins: t("standings.col_wins"),
    col_losses: t("standings.col_losses"),
    col_sets: t("standings.col_sets"),
    col_games: t("standings.col_games"),
    close_groups_title: t("groups.close_groups_title"),
    close_groups_help: t("groups.close_groups_help"),
    advance_per_group_label: t("groups.advance_per_group_label"),
    playoff_size_label: t("groups.playoff_size_label"),
    close_groups_cta: t("groups.close_groups_cta"),
    closing: t("groups.closing"),
    qualifiers_summary: t("groups.qualifiers_summary"),
    playoff_too_small: t("groups.playoff_too_small"),
    groups_pending: t("groups.groups_pending"),
    error: t("bracket.error"),
  };

  const locked = tournament.status === "in_progress" || tournament.status === "finished";

  const dialogCopy = buildTournamentDialogCopy(t);
  const registrationLinkCopy: RegistrationLinkCopy = {
    title: t("registration_link.title"),
    description: t("registration_link.description"),
    copy: t("registration_link.copy"),
    copied: t("registration_link.copied"),
    open: t("registration_link.open"),
    hint_draft: t("registration_link.hint_draft"),
    hint_club: t("registration_link.hint_club"),
    hint_ready: t("registration_link.hint_ready"),
    hint_closed: t("registration_link.hint_closed"),
  };

  const statusTone = (
    tournament.status === "draft" ? "ink"
    : tournament.status === "registration" ? "ball"
    : tournament.status === "in_progress" ? "grass"
    : tournament.status === "finished" ? "grass"
    : "clay"
  ) as "ink" | "ball" | "grass" | "clay";

  return (
    <div className="page-shell space-y-6">
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={"/me/tournaments/organized" as any}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
      >
        <ArrowLeft className="h-4 w-4" /> {t("detail.back")}
      </Link>

      <PageHeader
        title={tournament.name}
        help={
          <HelpPanel
            pageId="me-tournaments-organized-detail"
            variant="inline"
            why={t("detail.help.why")}
            what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
            result={[t("detail.help.result.1"), t("detail.help.result.2")]}
          />
        }
        actions={
          <>
            <EditTournamentButton
              tournament={tournament}
              venueOptions={venueOptions}
              clubOptions={clubOptions}
              dialogCopy={dialogCopy}
              label={t("detail.edit")}
              lockedHint={locked ? t("detail.edit_locked_hint") : null}
            />
            <Chip tone={statusTone}>{statusLabels[tournament.status]}</Chip>
          </>
        }
      />

      <div className="surface-card">
        <p className="inline-flex items-center gap-1 text-sm text-ink-600">
          <Trophy className="h-3.5 w-3.5" />
          {formatLabels[tournament.format]}
          {tournament.surface && ` · ${surfaceLabels[tournament.surface]}`}
        </p>

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
            {tournament.entry_fee_byn == null || tournament.entry_fee_byn === 0
              ? t("detail.entry_fee_free")
              : t("detail.entry_fee_byn", { n: tournament.entry_fee_byn })}
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
      </div>

      <StatusControl
        tournamentId={tournament.id}
        status={tournament.status}
        copy={
          {
            draft_title: t("status_control.draft_title"),
            draft_body: t("status_control.draft_body"),
            open_registration: t("status_control.open_registration"),
            opening: t("status_control.opening"),
            registration_title: t("status_control.registration_title"),
            registration_body: t("status_control.registration_body"),
            revert_to_draft: t("status_control.revert_to_draft"),
            reverting: t("status_control.reverting"),
            revert_confirm: t("status_control.revert_confirm"),
          } satisfies StatusControlCopy
        }
      />

      <RegistrationLink
        path={`/${locale}/tournaments/${tournament.id}`}
        status={tournament.status}
        privacy={tournament.privacy}
        copy={registrationLinkCopy}
      />

      <TournamentBrandingSection
        tournamentId={tournament.id}
        publicHref={`/${locale}/tournaments/${tournament.id}`}
        initial={branding}
      />

      <PrivacyControl
        tournamentId={tournament.id}
        initialPrivacy={tournament.privacy}
        publicHref={`/${locale}/tournaments/${tournament.id}`}
        copy={
          {
            status_label: t("privacy_control.status_label"),
            club_label: t("privacy.club"),
            public_label: t("privacy.public"),
            club_hint: t("privacy_control.club_hint"),
            public_hint: t("privacy_control.public_hint"),
            publish_button: t("privacy_control.publish_button"),
            unpublish_button: t("privacy_control.unpublish_button"),
            publishing: t("privacy_control.publishing"),
            hidden_results_title: t("privacy_control.hidden_results_title"),
            hidden_results_body: t("privacy_control.hidden_results_body"),
            visible_results_title: t("privacy_control.visible_results_title"),
            visible_results_body: t("privacy_control.visible_results_body"),
            view_public: t("privacy_control.view_public"),
            error_prefix: t("bracket.error"),
          } satisfies PrivacyControlCopy
        }
      />

      <ParticipantsSection
        tournamentId={tournament.id}
        participants={participants}
        options={playerOptions}
        copy={participantsCopy}
        locked={locked}
      />

      {tournament.format === "group_playoff" && (
        <GroupsSection
          tournamentId={tournament.id}
          format={tournament.format}
          groupsCount={tournament.groups_count}
          advancePerGroup={tournament.advance_per_group}
          playoffSize={tournament.playoff_size}
          thirdPlaceMatch={tournament.third_place_match}
          participants={participants}
          groups={groups}
          matches={matches}
          standings={await loadGroupStandings(tournament.id)}
          copy={groupsCopy}
          bracketCopy={bracketCopy}
          matchRules={tournament.match_rules}
        />
      )}

      <BracketSection
        tournamentId={tournament.id}
        matches={matches}
        copy={bracketCopy}
        participantsCount={tournament.participants_count}
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
