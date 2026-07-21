import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
  TOURNAMENT_DISCIPLINES,
  SURFACES,
  SEEDING_METHODS,
  PRIVACY_OPTIONS,
  APPLICATION_MODES,
  MATCH_RULE_KINDS,
  type TournamentFormat,
  type TournamentStatus,
  type TournamentDiscipline,
  type Surface,
  type SeedingMethod,
  type Privacy,
  type ApplicationMode,
  type MatchRuleKind,
} from "@/lib/tournaments/schema";
import type { TournamentDialogCopy } from "./tournament-form-dialog";

/** Minimal structural type for a next-intl translator scoped to
 * `tournamentsOrganized`. Matches both `useTranslations` and
 * `getTranslations` results. */
export type OrganizedTranslator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

export function buildFormatLabels(t: OrganizedTranslator): Record<TournamentFormat, string> {
  return Object.fromEntries(TOURNAMENT_FORMATS.map((f) => [f, t(`formats.${f}`)])) as Record<
    TournamentFormat,
    string
  >;
}

export function buildDisciplineLabels(
  t: OrganizedTranslator,
): Record<TournamentDiscipline, string> {
  return Object.fromEntries(
    TOURNAMENT_DISCIPLINES.map((d) => [d, t(`disciplines.${d}`)]),
  ) as Record<TournamentDiscipline, string>;
}

export function buildStatusLabels(t: OrganizedTranslator): Record<TournamentStatus, string> {
  return Object.fromEntries(TOURNAMENT_STATUSES.map((s) => [s, t(`statuses.${s}`)])) as Record<
    TournamentStatus,
    string
  >;
}

export function buildSurfaceLabels(t: OrganizedTranslator): Record<Surface, string> {
  return Object.fromEntries(SURFACES.map((s) => [s, t(`surfaces.${s}`)])) as Record<
    Surface,
    string
  >;
}

/**
 * Assembles the (large) copy object of `TournamentFormDialog` from the
 * `tournamentsOrganized` namespace. Shared between the organized-tournaments
 * page and the club organizer panel so the two stay in sync.
 */
export function buildTournamentDialogCopy(t: OrganizedTranslator): TournamentDialogCopy {
  const formatLabels = buildFormatLabels(t);
  const surfaceLabels = buildSurfaceLabels(t);
  const drawMethodLabels = Object.fromEntries(
    SEEDING_METHODS.map((m) => [m, t(`draw_methods.${m}`)]),
  ) as Record<SeedingMethod, string>;
  const privacyLabels = Object.fromEntries(
    PRIVACY_OPTIONS.map((p) => [p, t(`privacy.${p}`)]),
  ) as Record<Privacy, string>;
  const applicationModeLabels = Object.fromEntries(
    APPLICATION_MODES.map((m) => [m, t(`application_modes.${m}`)]),
  ) as Record<ApplicationMode, string>;
  const matchRuleLabels = Object.fromEntries(
    MATCH_RULE_KINDS.map((k) => [k, t(`match_rule_kinds.${k}`)]),
  ) as Record<MatchRuleKind, string>;

  return {
    create_title: t("dialog.create_title"),
    edit_title: t("dialog.edit_title"),
    duplicate_title: t("dialog.duplicate_title"),
    template_title: t("dialog.template_title"),
    third_place_match_label: t("dialog.third_place_match_label"),
    third_place_match_hint: t("dialog.third_place_match_hint"),
    hide_organizer_label: t("dialog.hide_organizer_label"),
    hide_organizer_hint: t("dialog.hide_organizer_hint"),
    regulations: {
      section: t("dialog.regulations.section"),
      text_hint: t("dialog.regulations.text_hint"),
      file_label: t("dialog.regulations.file_label"),
      file_hint: t("dialog.regulations.file_hint"),
      upload: t("dialog.regulations.upload"),
      uploading: t("dialog.regulations.uploading"),
      remove: t("dialog.regulations.remove"),
      view: t("dialog.regulations.view"),
      file_error: t("dialog.regulations.file_error"),
    },
    fields: {
      name: t("dialog.fields.name"),
      description: t("dialog.fields.description"),
      format: t("dialog.fields.format"),
      discipline: t("dialog.fields.discipline"),
      surface: t("dialog.fields.surface"),
      starts_on: t("dialog.fields.starts_on"),
      start_time: t("dialog.fields.start_time"),
      ends_on: t("dialog.fields.ends_on"),
      registration_deadline: t("dialog.fields.registration_deadline"),
      max_participants: t("dialog.fields.max_participants"),
      entry_fee: t("dialog.fields.entry_fee"),
      entry_fee_currency: t("dialog.fields.entry_fee_currency"),
      venues: t("dialog.fields.venues"),
      club: t("dialog.fields.club"),
      privacy: t("dialog.fields.privacy"),
      application_mode: t("dialog.fields.application_mode"),
      draw_method: t("dialog.fields.draw_method"),
      prizes: t("dialog.fields.prizes"),
      match_rules: t("dialog.fields.match_rules"),
      set_target: t("dialog.fields.set_target"),
      target_games: t("dialog.fields.target_games"),
      minutes: t("dialog.fields.minutes"),
      no_ad: t("dialog.fields.no_ad"),
      super_tiebreak: t("dialog.fields.super_tiebreak"),
      set_tiebreak_at: t("dialog.fields.set_tiebreak_at"),
    },
    hints: {
      format: t("dialog.hints.format"),
      discipline: t("dialog.hints.discipline"),
      privacy: t("dialog.hints.privacy"),
      application_mode: t("dialog.hints.application_mode"),
      draw_method: t("dialog.hints.draw_method"),
      match_rules: t("dialog.hints.match_rules"),
      coming_soon: t("dialog.hints.coming_soon"),
      start_time: t("dialog.hints.start_time"),
      entry_fee: t("dialog.hints.entry_fee"),
      venues: t("dialog.hints.venues"),
      venues_empty_catalogue: t("dialog.hints.venues_empty_catalogue"),
      club: t("dialog.hints.club"),
    },
    format_labels: formatLabels,
    discipline_labels: buildDisciplineLabels(t),
    surface_labels: surfaceLabels,
    draw_method_labels: drawMethodLabels,
    privacy_labels: privacyLabels,
    application_mode_labels: applicationModeLabels,
    match_rule_labels: matchRuleLabels,
    save: t("dialog.save"),
    saving: t("dialog.saving"),
    cancel: t("dialog.cancel"),
    error: t("dialog.error"),
    none: t("dialog.none"),
  };
}
