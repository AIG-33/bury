import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { loadOrganizedTournaments, loadVenueOptions, loadAdministrableClubs } from "./actions";
import { loadMyTemplates } from "./template-actions";
import { OrganizedTournamentsClient, type OrganizedTournamentsCopy } from "./organized-client";
import {
  buildTournamentDialogCopy,
  buildFormatLabels,
  buildStatusLabels,
  buildSurfaceLabels,
} from "./dialog-copy";

type Props = { params: Promise<{ locale: string }> };

export default async function OrganizedTournamentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tournamentsOrganized");

  const [result, venueOptions, clubOptions, templatesResult] = await Promise.all([
    loadOrganizedTournaments(),
    loadVenueOptions(),
    loadAdministrableClubs(),
    loadMyTemplates(),
  ]);
  if (!result.ok) {
    if (result.error === "not_authenticated") {
      redirect(`/${locale}/login?next=/me/tournaments/organized`);
    }
    redirect(`/${locale}/login`);
  }

  const formatLabels = buildFormatLabels(t);
  const statusLabels = buildStatusLabels(t);
  const surfaceLabels = buildSurfaceLabels(t);

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
    co_organizer: t("list.co_organizer"),
    no_surface: t("list.no_surface"),
    entry_fee_free: t("list.entry_fee_free"),
    entry_fee_byn: t("list.entry_fee_byn"),
    pending_badge: t("list.pending_badge"),
    format_labels: formatLabels,
    status_labels: statusLabels,
    surface_labels: surfaceLabels,
    dialog: buildTournamentDialogCopy(t),
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
        templates={templatesResult.ok ? templatesResult.templates : []}
        copy={copy}
      />
    </div>
  );
}
