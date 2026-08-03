import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { UserVenueForm } from "@/components/venues/user-venue-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CourtSurface, UserVenueForm as UserVenueFormValues, VenueAmenity } from "@/lib/venues/schema";
import { DEFAULT_COUNTRY } from "@/lib/geo/countries";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "venuesCatalog.form" });
  return {
    ...buildPageMetadata({
      locale,
      path: `/venues/${id}/edit`,
      title: t("edit_title"),
      description: t("edit_title"),
    }),
    robots: { index: false },
  };
}

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  amenities: VenueAmenity[];
  website: string | null;
  phone: string | null;
  photos: string[];
  created_by: string | null;
};

export default async function EditVenuePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("venuesCatalog.form");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");

  const supabase = await createSupabaseServerClient();

  const { data: venue } = (await supabase
    .from("venues")
    .select(
      "id, name, city, country, address, lat, lng, amenities, website, phone, photos, created_by",
    )
    .eq("id", id)
    .maybeSingle()) as { data: VenueRow | null };
  if (!venue) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canEdit = false;
  if (user) {
    if (venue.created_by === user.id) {
      canEdit = true;
    } else {
      const { data: profile } = (await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()) as { data: { is_admin: boolean } | null };
      canEdit = profile?.is_admin === true;
    }
  }

  if (!canEdit) {
    return (
      <div className="page-shell space-y-6">
        <PageHeader title={t("edit_title")} />
        <EmptyState
          title={t("forbidden_title")}
          description={t("forbidden_body")}
          ctaHref={`/${locale}/venues/${id}`}
          ctaLabel={t("forbidden_cta")}
        />
      </div>
    );
  }

  const courtsRes = await supabase
    .from("courts")
    .select("id, number, name, surface, is_indoor")
    .eq("venue_id", id)
    .order("number", { ascending: true });

  const courts = (courtsRes.data ?? []) as Array<{
    id: string;
    number: number;
    name: string | null;
    surface: CourtSurface | null;
    is_indoor: boolean;
  }>;

  const initial: UserVenueFormValues & { id: string } = {
    id: venue.id,
    name: venue.name,
    city: venue.city,
    country: venue.country ?? DEFAULT_COUNTRY,
    address: venue.address,
    lat: venue.lat,
    lng: venue.lng,
    amenities: venue.amenities ?? [],
    website: venue.website,
    phone: venue.phone,
    photo_url: Array.isArray(venue.photos) && venue.photos.length > 0 ? venue.photos[0] : null,
    courts: courts.map((c) => ({
      id: c.id,
      number: c.number,
      name: c.name,
      surface: c.surface,
      is_indoor: c.is_indoor,
    })),
  };

  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: tCrumb("home"), path: "" },
          { name: tNav("venues"), path: "/venues" },
          { name: venue.name, path: `/venues/${id}` },
          { name: t("edit_title"), path: `/venues/${id}/edit` },
        ]}
      />
      <PageHeader title={t("edit_title")} subtitle={venue.name} />
      <UserVenueForm userId={user!.id} locale={locale} initial={initial} />
    </div>
  );
}
