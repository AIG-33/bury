import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
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
      redirect(`/${locale}/login?next=/coach/venues/${id}`);
    }
    if (result.error === "not_found") notFound();
    redirect(`/${locale}/coach/venues`);
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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={`/${locale}/coach/venues` as any}
        className="inline-flex items-center gap-1 text-sm text-ink-500 transition hover:text-grass-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("detail.back")}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{venue.name}</h1>
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
              (venue.is_indoor
                ? "bg-grass-100 text-grass-800 ring-1 ring-grass-200"
                : "bg-ball-100 text-ball-800 ring-1 ring-ball-200")
            }
          >
            {venue.is_indoor ? t("list.indoor") : t("list.outdoor")}
          </span>
        </div>
        <p className="inline-flex items-center gap-1 text-sm text-ink-600">
          <MapPin className="h-3.5 w-3.5" />
          {[venue.city, venue.district_name].filter(Boolean).join(" · ") ||
            t("list.no_district")}
        </p>
        {venue.address && <p className="text-sm text-ink-500">{venue.address}</p>}
      </header>

      <HelpPanel
        pageId="coach-venue-detail"
        why={t("detail.help.why")}
        what={[t("detail.help.what.1"), t("detail.help.what.2"), t("detail.help.what.3")]}
        result={[t("detail.help.result.1"), t("detail.help.result.2")]}
      />

      {venue.amenities.length > 0 && (
        <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 font-display text-base font-semibold text-ink-900">
            {t("detail.amenities_title")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {venue.amenities.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full bg-grass-50 px-3 py-1 text-xs font-medium text-grass-800 ring-1 ring-grass-200"
              >
                {AMENITY_ICONS[a]}
                {t(`amenities.${a}`)}
              </span>
            ))}
          </div>
        </section>
      )}

      <CourtsManager
        venueId={venue.id}
        initialCourts={courts}
        copy={courtsCopy}
      />
    </div>
  );
}
