import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { loadAdminVenues } from "./actions";
import { VenuesClient, type VenuesListCopy } from "./venues-client";
import {
  VENUE_AMENITIES,
  VENUE_INDOOR_STATUSES,
  type VenueAmenity,
  type VenueIndoorStatus,
} from "@/lib/venues/schema";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminVenuesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("venues");

  const result = await loadAdminVenues();
  if (!result.ok) {
    if (result.error === "not_authenticated") redirect(`/${locale}/login?next=/admin/venues`);
    if (result.error === "not_an_admin") redirect(`/${locale}/me/profile`);
    redirect(`/${locale}/login`);
  }

  const amenityLabels = Object.fromEntries(
    VENUE_AMENITIES.map((a) => [a, t(`amenities.${a}`)]),
  ) as Record<VenueAmenity, string>;

  const indoorStatusLabels = Object.fromEntries(
    VENUE_INDOOR_STATUSES.map((s) => [s, t(`list.${s}`)]),
  ) as Record<VenueIndoorStatus, string>;

  const copy: VenuesListCopy = {
    empty_title: t("list.empty_title"),
    empty_description: t("list.empty_description"),
    empty_cta: t("list.empty_cta"),
    add: t("list.add"),
    edit: t("list.edit"),
    delete: t("list.delete"),
    delete_confirm: t("list.delete_confirm"),
    deleting: t("list.deleting"),
    open: t("list.open"),
    indoor_status_labels: indoorStatusLabels,
    no_district: t("list.no_district"),
    amenity_labels: amenityLabels,
    dialog: {
      create_title: t("dialog.create_title"),
      edit_title: t("dialog.edit_title"),
      fields: {
        name: t("dialog.fields.name"),
        city: t("dialog.fields.city"),
        district: t("dialog.fields.district"),
        district_placeholder: t("dialog.fields.district_placeholder"),
        address: t("dialog.fields.address"),
        lat: t("dialog.fields.lat"),
        lng: t("dialog.fields.lng"),
        amenities: t("dialog.fields.amenities"),
      },
      hints: {
        lat_lng: t("dialog.hints.lat_lng"),
        address: t("dialog.hints.address"),
        amenities: t("dialog.hints.amenities"),
        indoor_status: t("dialog.hints.indoor_status"),
      },
      amenity_labels: amenityLabels,
      save: t("dialog.save"),
      saving: t("dialog.saving"),
      cancel: t("dialog.cancel"),
      saved: t("dialog.saved"),
      error: t("dialog.error"),
      none: t("dialog.none"),
    },
  };

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="admin-venues"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <VenuesClient
        locale={locale}
        venues={result.venues}
        districts={result.districts}
        copy={copy}
      />
    </div>
  );
}
