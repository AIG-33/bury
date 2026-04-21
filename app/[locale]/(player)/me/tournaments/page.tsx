import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import {
  loadOpenTournaments,
  loadMyTournaments,
} from "./actions";
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

  const openRes = await loadOpenTournaments();
  const mineRes = await loadMyTournaments();
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
    open_empty_title: t("open_empty_title"),
    open_empty_description: t("open_empty_description"),
    mine_empty_title: t("mine_empty_title"),
    mine_empty_description: t("mine_empty_description"),
    register: t("register"),
    registering: t("registering"),
    registered: t("registered"),
    withdraw: t("withdraw"),
    withdrawing: t("withdrawing"),
    withdraw_confirm: t("withdraw_confirm"),
    next_match: t("next_match"),
    no_next_match: t("no_next_match"),
    vs: t("vs"),
    by_coach: t("by_coach"),
    format_labels: formatLabels,
    status_labels: statusLabels,
    surface_labels: surfaceLabels,
    error: t("error"),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="me-tournaments"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <PlayerTournamentsClient
        open={openRes.tournaments}
        mine={mineRes.tournaments}
        copy={copy}
      />
    </div>
  );
}
