import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { loadAdminVenues } from "./actions";
import { VenuesClient, type VenuesListCopy } from "./venues-client";
import { VENUE_AMENITIES, type VenueAmenity } from "@/lib/venues/schema";

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
    courts: (n: number) => t("list.courts", { n }),
    indoor: t("list.indoor"),
    outdoor: t("list.outdoor"),
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
        is_indoor: t("dialog.fields.is_indoor"),
        amenities: t("dialog.fields.amenities"),
      },
      hints: {
        lat_lng: t("dialog.hints.lat_lng"),
        address: t("dialog.hints.address"),
        amenities: t("dialog.hints.amenities"),
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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
          <HelpPanel
            pageId="admin-venues"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <VenuesClient
        locale={locale}
        venues={result.venues}
        districts={result.districts}
        copy={copy}
      />
    </div>
  );
}
