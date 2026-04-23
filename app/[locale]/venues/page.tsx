import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  MapPin,
  Building2,
  Sun,
  CloudSun,
  Lightbulb,
  ShowerHead,
  Lock,
  CarFront,
  ShoppingBag,
  Wifi,
  Coffee,
  Bath,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { COURT_SURFACES, type CourtSurface, type CourtStatus } from "@/lib/venues/schema";

type Props = { params: Promise<{ locale: string }> };

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  district_id: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  is_indoor: boolean;
  amenities: string[];
};

type CourtRow = {
  id: string;
  venue_id: string;
  number: number;
  name: string | null;
  surface: CourtSurface | null;
  status: CourtStatus;
};

type DistrictRow = { id: string; name: string };

type VenueCard = VenueRow & {
  district_name: string | null;
  courts: CourtRow[];
};

const AMENITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  indoor: Building2,
  outdoor: Sun,
  lights: Lightbulb,
  // Aliases used in seed data: floodlights → lights, showers → shower,
  // indoor_courts → indoor, pro_shop → shop. We map them through.
  floodlights: Lightbulb,
  shower: ShowerHead,
  showers: ShowerHead,
  lockers: Lock,
  parking: CarFront,
  shop: ShoppingBag,
  pro_shop: ShoppingBag,
  wifi: Wifi,
  cafe: Coffee,
  bathrooms: Bath,
  indoor_courts: Building2,
};

const SURFACE_DOT: Record<CourtSurface, string> = {
  hard: "bg-sky-500",
  clay: "bg-clay-500",
  grass: "bg-grass-500",
  carpet: "bg-ink-500",
};

export default async function VenuesCatalogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("venuesCatalog");
  const tAmenities = await getTranslations("venues.amenities");
  const tSurfaces = await getTranslations("venues.detail.courts.surface_options");
  const tStatuses = await getTranslations("venues.detail.courts.status_options");

  const supabase = await createSupabaseServerClient();

  const { data: venuesRaw } = (await supabase
    .from("venues")
    .select("id, name, city, district_id, address, lat, lng, is_indoor, amenities")
    .order("name", { ascending: true })) as { data: VenueRow[] | null };

  const venues = venuesRaw ?? [];

  const districtIds = Array.from(
    new Set(venues.map((v) => v.district_id).filter((x): x is string => Boolean(x))),
  );
  const districtMap = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: districts } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as { data: DistrictRow[] | null };
    for (const d of districts ?? []) districtMap.set(d.id, d.name);
  }

  const venueIds = venues.map((v) => v.id);
  const courtsByVenue = new Map<string, CourtRow[]>();
  if (venueIds.length > 0) {
    const { data: courts } = (await supabase
      .from("courts")
      .select("id, venue_id, number, name, surface, status")
      .in("venue_id", venueIds)
      .order("number", { ascending: true })) as { data: CourtRow[] | null };
    for (const c of courts ?? []) {
      const arr = courtsByVenue.get(c.venue_id) ?? [];
      arr.push(c);
      courtsByVenue.set(c.venue_id, arr);
    }
  }

  const cards: VenueCard[] = venues.map((v) => ({
    ...v,
    district_name: v.district_id ? (districtMap.get(v.district_id) ?? null) : null,
    courts: courtsByVenue.get(v.id) ?? [],
  }));

  const totalCourts = cards.reduce((sum, c) => sum + c.courts.length, 0);

  function amenityLabel(key: string): string {
    // Aliases that aren't in messages — map to canonical key first.
    const alias: Record<string, string> = {
      floodlights: "lights",
      showers: "shower",
      pro_shop: "shop",
      indoor_courts: "indoor",
    };
    const canonical = alias[key] ?? key;
    try {
      return tAmenities(canonical as never);
    } catch {
      return canonical;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
          <HelpPanel
            pageId="venues-catalog"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        </div>
        <p className="text-ink-600">
          {t("subtitle", { venues: cards.length, courts: totalCourts })}
        </p>
      </header>

      {cards.length === 0 ? (
        <EmptyState title={t("empty_title")} description={t("empty_description")} />
      ) : (
        <ul className="space-y-4">
          {cards.map((v) => {
            const mapsHref =
              v.lat != null && v.lng != null
                ? `https://www.google.com/maps?q=${v.lat},${v.lng}`
                : v.address
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${v.name} ${v.address ?? ""} ${v.city ?? ""}`,
                    )}`
                  : null;
            return (
              <li
                key={v.id}
                className="overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card"
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="font-display text-xl font-semibold text-ink-900">
                        {v.name}
                      </h2>
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                          (v.is_indoor
                            ? "bg-sky-50 text-sky-700"
                            : "bg-ball-50 text-ball-800")
                        }
                      >
                        {v.is_indoor ? (
                          <>
                            <Building2 className="h-3 w-3" />
                            {t("indoor")}
                          </>
                        ) : (
                          <>
                            <CloudSun className="h-3 w-3" />
                            {t("outdoor")}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
                      {(v.city || v.district_name) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-ink-400" />
                          {[v.city, v.district_name].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {v.address && (
                        <span className="text-ink-500">{v.address}</span>
                      )}
                      {mapsHref && (
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-grass-700 hover:underline"
                        >
                          {t("open_in_maps")}
                        </a>
                      )}
                    </div>

                    {v.amenities.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5 pt-1">
                        {v.amenities.map((a) => {
                          const Icon = AMENITY_ICONS[a] ?? Building2;
                          return (
                            <li
                              key={a}
                              className="inline-flex items-center gap-1 rounded-md bg-ink-50 px-2 py-0.5 text-[11px] text-ink-700 ring-1 ring-ink-100"
                            >
                              <Icon className="h-3 w-3 text-ink-500" />
                              {amenityLabel(a)}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="w-full shrink-0 sm:w-[260px]">
                    <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                      {t("courts_title", { n: v.courts.length })}
                    </p>
                    {v.courts.length === 0 ? (
                      <p className="text-xs text-ink-400">{t("courts_empty")}</p>
                    ) : (
                      <ul className="divide-y divide-ink-100 overflow-hidden rounded-lg ring-1 ring-ink-100">
                        {v.courts.map((c) => {
                          const dot = c.surface ? SURFACE_DOT[c.surface] : "bg-ink-300";
                          const surfaceLabel = c.surface
                            ? tSurfaces(c.surface)
                            : "—";
                          const isMaintenance = c.status === "maintenance";
                          return (
                            <li
                              key={c.id}
                              className={
                                "flex items-center gap-2 px-3 py-1.5 text-xs " +
                                (isMaintenance ? "bg-ink-50/40 text-ink-500" : "text-ink-700")
                              }
                            >
                              <span className="font-mono w-7 tabular-nums text-ink-500">
                                #{c.number}
                              </span>
                              <span className="flex-1 truncate">{c.name ?? "—"}</span>
                              <span className="inline-flex items-center gap-1">
                                <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
                                {surfaceLabel}
                              </span>
                              {isMaintenance && (
                                <span className="ml-1 rounded-full bg-clay-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-clay-700">
                                  {tStatuses("maintenance")}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-ink-500">
        {t("footnote_surfaces", {
          surfaces: COURT_SURFACES.map((s) => tSurfaces(s)).join(" · "),
        })}
      </p>
    </div>
  );
}
