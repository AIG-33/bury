import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { loadCoachTournaments } from "./actions";
import { TournamentsClient, type TournamentsListCopy } from "./tournaments-client";
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
  SURFACES,
  SEEDING_METHODS,
  PRIVACY_OPTIONS,
  MATCH_RULE_KINDS,
  type TournamentFormat,
  type TournamentStatus,
  type Surface,
  type SeedingMethod,
  type Privacy,
  type MatchRuleKind,
} from "@/lib/tournaments/schema";

type Props = { params: Promise<{ locale: string }> };

export default async function CoachTournamentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsCoach");

  const result = await loadCoachTournaments();
  if (!result.ok) {
    if (result.error === "not_authenticated") {
      redirect(`/${locale}/login?next=/coach/tournaments`);
    }
    if (result.error === "not_a_coach") redirect(`/${locale}/me/profile`);
    redirect(`/${locale}/login`);
  }

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
  const privacyLabels = Object.fromEntries(
    PRIVACY_OPTIONS.map((p) => [p, t(`privacy.${p}`)]),
  ) as Record<Privacy, string>;
  const matchRuleLabels = Object.fromEntries(
    MATCH_RULE_KINDS.map((k) => [k, t(`match_rule_kinds.${k}`)]),
  ) as Record<MatchRuleKind, string>;

  const copy: TournamentsListCopy = {
    empty_title: t("list.empty_title"),
    empty_description: t("list.empty_description"),
    empty_cta: t("list.empty_cta"),
    add: t("list.add"),
    edit: t("list.edit"),
    delete: t("list.delete"),
    delete_confirm: t("list.delete_confirm"),
    deleting: t("list.deleting"),
    open: t("list.open"),
    no_surface: t("list.no_surface"),
    format_labels: formatLabels,
    status_labels: statusLabels,
    surface_labels: surfaceLabels,
    dialog: {
      create_title: t("dialog.create_title"),
      edit_title: t("dialog.edit_title"),
      fields: {
        name: t("dialog.fields.name"),
        description: t("dialog.fields.description"),
        format: t("dialog.fields.format"),
        surface: t("dialog.fields.surface"),
        starts_on: t("dialog.fields.starts_on"),
        ends_on: t("dialog.fields.ends_on"),
        registration_deadline: t("dialog.fields.registration_deadline"),
        max_participants: t("dialog.fields.max_participants"),
        privacy: t("dialog.fields.privacy"),
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
        privacy: t("dialog.hints.privacy"),
        draw_method: t("dialog.hints.draw_method"),
        match_rules: t("dialog.hints.match_rules"),
        coming_soon: t("dialog.hints.coming_soon"),
      },
      format_labels: formatLabels,
      surface_labels: surfaceLabels,
      draw_method_labels: drawMethodLabels,
      privacy_labels: privacyLabels,
      match_rule_labels: matchRuleLabels,
      save: t("dialog.save"),
      saving: t("dialog.saving"),
      cancel: t("dialog.cancel"),
      error: t("dialog.error"),
      none: t("dialog.none"),
    },
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="coach-tournaments"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <TournamentsClient locale={locale} tournaments={result.tournaments} copy={copy} />
    </div>
  );
}
