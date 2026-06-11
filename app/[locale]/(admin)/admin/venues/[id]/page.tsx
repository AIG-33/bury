import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import {
  ChevronLeft,
  MapPin,
  Wifi,
  Lock,
  ShowerHead,
  Car,
  ShoppingBag,
  Coffee,
  Lightbulb,
  Bath,
  CloudSun,
  Building2,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Surface, Chip } from "@/components/ui/surface";
import { IndoorStatusBadge } from "@/components/venues/indoor-status-badge";
import { loadVenueDetail } from "../actions";
import { CourtsManager, type CourtsManagerCopy } from "./courts-manager";
import {
  COURT_SURFACES,
  COURT_STATUSES,
  type CourtSurface,
  type CourtStatus,
  type VenueAmenity,
} from "@/lib/venues/schema";

const AMENITY_ICONS: Record<VenueAmenity, React.ReactNode> = {
  indoor: <Building2 className="h-3.5 w-3.5" />,
  outdoor: <CloudSun className="h-3.5 w-3.5" />,
  lights: <Lightbulb className="h-3.5 w-3.5" />,
  shower: <ShowerHead className="h-3.5 w-3.5" />,
  lockers: <Lock className="h-3.5 w-3.5" />,
  parking: <Car className="h-3.5 w-3.5" />,
  shop: <ShoppingBag className="h-3.5 w-3.5" />,
  wifi: <Wifi className="h-3.5 w-3.5" />,
  cafe: <Coffee className="h-3.5 w-3.5" />,
  bathrooms: <Bath className="h-3.5 w-3.5" />,
};

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function VenueDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("venues");

  const result = await loadVenueDetail(id);
  if (!result.ok) {
    if (result.error === "not_authenticated") {
      redirect(`/${locale}/login?next=/admin/venues/${id}`);
    }
    if (result.error === "not_an_admin") redirect(`/${locale}/me/profile`);
    if (result.error === "not_found") notFound();
    redirect(`/${locale}/admin/venues`);
  }

  const { venue, courts } = result;

  const courtsCopy: CourtsManagerCopy = {
    title: t("detail.courts.title"),
    intro: t("detail.courts.intro"),
    empty: t("detail.courts.empty"),
    add_title: t("detail.courts.add_title"),
    number: t("detail.courts.number"),
    name: t("detail.courts.name"),
    name_placeholder: t("detail.courts.name_placeholder"),
    surface: t("detail.courts.surface"),
    indoor_label: t("detail.courts.indoor_label"),
    indoor_yes: t("detail.courts.indoor_yes"),
    indoor_no: t("detail.courts.indoor_no"),
    status: t("detail.courts.status"),
    status_options: Object.fromEntries(
      COURT_STATUSES.map((s) => [s, t(`detail.courts.status_options.${s}`)]),
    ) as Record<CourtStatus, string>,
    surface_options: Object.fromEntries(
      COURT_SURFACES.map((s) => [s, t(`detail.courts.surface_options.${s}`)]),
    ) as Record<CourtSurface, string>,
    none: t("detail.courts.none"),
    add: t("detail.courts.add"),
    adding: t("detail.courts.adding"),
    save: t("detail.courts.save"),
    saving: t("detail.courts.saving"),
    saved: t("detail.courts.saved"),
    delete: t("detail.courts.delete"),
    delete_confirm: t("detail.courts.delete_confirm"),
    duplicate: t("detail.courts.duplicate"),
    error: t("dialog.error"),
  };

  return (
    <div className="page-shell space-y-8">
      <Link
        href="/admin/venues"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 transition hover:text-grass-700"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> {t("detail.back")}
      </Link>

      <PageHeader
        eyebrow={t("eyebrow")}
        title={venue.name}
        subtitle={
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {[venue.city, venue.district_name].filter(Boolean).join(" · ") || t("list.no_district")}
            {venue.address ? ` · ${venue.address}` : ""}
          </span>
        }
        help={
          <HelpPanel
            pageId="admin-venue-detail"
            variant="inline"
            why={t("detail.help.why")}
            what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
            result={[t("detail.help.result.1"), t("detail.help.result.2")]}
          />
        }
        actions={
          <IndoorStatusBadge
            status={venue.indoor_status}
            label={t(`list.${venue.indoor_status}`)}
          />
        }
      />

      {venue.amenities.length > 0 && (
        <Surface variant="flat" as="section">
          <h2 className="mb-3 font-display text-base font-semibold text-ink-900">
            {t("detail.amenities_title")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {venue.amenities.map((a) => (
              <Chip
                key={a}
                tone="grass"
                className="inline-flex items-center gap-1.5"
              >
                {AMENITY_ICONS[a]}
                {t(`amenities.${a}`)}
              </Chip>
            ))}
          </div>
        </Surface>
      )}

      <CourtsManager venueId={venue.id} initialCourts={courts} copy={courtsCopy} />
    </div>
  );
}
