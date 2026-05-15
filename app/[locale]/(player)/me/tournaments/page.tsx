import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { loadOpenTournaments, loadMyTournaments } from "./actions";
import { loadOrganizedTournaments } from "./organized/actions";
import {
  PlayerTournamentsClient,
  type PlayerTournamentsCopy,
} from "./tournaments-client";
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
  SURFACES,
  type TournamentFormat,
  type TournamentStatus,
  type Surface,
} from "@/lib/tournaments/schema";

type Props = { params: Promise<{ locale: string }> };

export default async function PlayerTournamentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsPlayer");

  const [openRes, mineRes, organizedRes] = await Promise.all([
    loadOpenTournaments(),
    loadMyTournaments(),
    loadOrganizedTournaments(),
  ]);
  if (!openRes.ok) {
    if (openRes.error === "not_authenticated") {
      redirect(`/${locale}/login?next=/me/tournaments`);
    }
    redirect(`/${locale}/login`);
  }
  if (!mineRes.ok) {
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

  const copy: PlayerTournamentsCopy = {
    tab_open: t("tab_open"),
    tab_mine: t("tab_mine"),
    tab_organized: t("tab_organized"),
    create_cta: t("create_cta"),
    open_empty_title: t("open_empty_title"),
    open_empty_description: t("open_empty_description"),
    mine_empty_title: t("mine_empty_title"),
    mine_empty_description: t("mine_empty_description"),
    organized_empty_title: t("organized_empty_title"),
    organized_empty_description: t("organized_empty_description"),
    apply: t("apply"),
    applying: t("applying"),
    application_pending: t("application_pending"),
    application_approved: t("application_approved"),
    application_rejected: t("application_rejected"),
    cancel_application: t("cancel_application"),
    withdraw: t("withdraw"),
    withdrawing: t("withdrawing"),
    withdraw_confirm: t("withdraw_confirm"),
    cancel_application_confirm: t("cancel_application_confirm"),
    next_match: t("next_match"),
    no_next_match: t("no_next_match"),
    vs: t("vs"),
    by_organizer: t("by_organizer"),
    pending_badge: t("pending_badge"),
    open_organizer: t("open_organizer"),
    format_labels: formatLabels,
    status_labels: statusLabels,
    surface_labels: surfaceLabels,
    error: t("error"),
  };

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="me-tournaments"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <PlayerTournamentsClient
        locale={locale}
        open={openRes.tournaments}
        mine={mineRes.tournaments}
        organized={organizedRes.ok ? organizedRes.tournaments : []}
        copy={copy}
      />
    </div>
  );
}
