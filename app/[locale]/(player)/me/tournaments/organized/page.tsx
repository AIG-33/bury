import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { loadOrganizedTournaments, loadVenueOptions, loadAdministrableClubs } from "./actions";
import { OrganizedTournamentsClient, type OrganizedTournamentsCopy } from "./organized-client";
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

export default async function OrganizedTournamentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsOrganized");

  const [result, venueOptions, clubOptions] = await Promise.all([
    loadOrganizedTournaments(),
    loadVenueOptions(),
    loadAdministrableClubs(),
  ]);
  if (!result.ok) {
    if (result.error === "not_authenticated") {
      redirect(`/${locale}/login?next=/me/tournaments/organized`);
    }
    redirect(`/${locale}/login`);
  }

  const formatLabels = Object.fromEntries(
    TOURNAMENT_FORMATS.map((f) => [f, t(`formats.${f}`)]),
  ) as Record<TournamentFormat, string>;
  const statusLabels = Object.fromEntries(
    TOURNAMENT_STATUSES.map((s) => [s, t(`statuses.${s}`)]),
  ) as Record<TournamentStatus, string>;
  const surfaceLabels = Object.fromEntries(SURFACES.map((s) => [s, t(`surfaces.${s}`)])) as Record<
    Surface,
    string
  >;
  const drawMethodLabels = Object.fromEntries(
    SEEDING_METHODS.map((m) => [m, t(`draw_methods.${m}`)]),
  ) as Record<SeedingMethod, string>;
  const privacyLabels = Object.fromEntries(
    PRIVACY_OPTIONS.map((p) => [p, t(`privacy.${p}`)]),
  ) as Record<Privacy, string>;
  const matchRuleLabels = Object.fromEntries(
    MATCH_RULE_KINDS.map((k) => [k, t(`match_rule_kinds.${k}`)]),
  ) as Record<MatchRuleKind, string>;

  const copy: OrganizedTournamentsCopy = {
    empty_title: t("list.empty_title"),
    empty_description: t("list.empty_description"),
    empty_cta: t("list.empty_cta"),
    add: t("list.add"),
    edit: t("list.edit"),
    duplicate: t("list.duplicate"),
    copy_suffix: t("list.copy_suffix"),
    delete: t("list.delete"),
    delete_confirm: t("list.delete_confirm"),
    deleting: t("list.deleting"),
    open: t("list.open"),
    no_surface: t("list.no_surface"),
    entry_fee_free: t("list.entry_fee_free"),
    entry_fee_byn: t("list.entry_fee_byn"),
    pending_badge: t("list.pending_badge"),
    format_labels: formatLabels,
    status_labels: statusLabels,
    surface_labels: surfaceLabels,
    dialog: {
      create_title: t("dialog.create_title"),
      edit_title: t("dialog.edit_title"),
      duplicate_title: t("dialog.duplicate_title"),
      third_place_match_label: t("dialog.third_place_match_label"),
      third_place_match_hint: t("dialog.third_place_match_hint"),
      fields: {
        name: t("dialog.fields.name"),
        description: t("dialog.fields.description"),
        format: t("dialog.fields.format"),
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
        start_time: t("dialog.hints.start_time"),
        entry_fee: t("dialog.hints.entry_fee"),
        venues: t("dialog.hints.venues"),
        venues_empty_catalogue: t("dialog.hints.venues_empty_catalogue"),
        club: t("dialog.hints.club"),
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
    <div className="page-shell space-y-6">
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={"/me/tournaments" as any}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-grass-800"
      >
        <ArrowLeft className="h-4 w-4" /> {t("back_to_player_tournaments")}
      </Link>

      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="me-tournaments-organized"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <OrganizedTournamentsClient
        locale={locale}
        tournaments={result.tournaments}
        venueOptions={venueOptions}
        clubOptions={clubOptions}
        copy={copy}
      />
    </div>
  );
}
