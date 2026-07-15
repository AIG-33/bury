import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { buildVenueJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Link } from "@/i18n/routing";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CloudSun,
  Globe,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  Trophy,
} from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { EmptyState } from "@/components/help/empty-state";
import { LevelBadge } from "@/components/rating/level-badge";
import { IndoorStatusBadge } from "@/components/venues/indoor-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { VenueComments } from "@/components/venues/venue-comments";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CourtSurface } from "@/lib/venues/schema";
import { loadVenueDetail } from "./actions";
import { loadVenueComments } from "./comment-actions";
import { VenueTabs } from "./venue-tabs";

type Props = { params: Promise<{ locale: string; id: string }> };

const SURFACE_DOT: Record<CourtSurface, string> = {
  hard: "bg-hard-cobalt",
  clay: "bg-clay-500",
  grass: "bg-grass-500",
  carpet: "bg-carpet-500",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const venue = await loadVenueDetail(id);
  if (!venue) return { title: "—", robots: { index: false } };
  const t = await getTranslations({ locale, namespace: "venuesCatalog" });
  return buildPageMetadata({
    locale,
    path: `/venues/${id}`,
    title: venue.name,
    description: t("subtitle", { venues: 1, courts: venue.courts.length }),
  });
}

export default async function VenueDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("venuesCatalog");
  const tDetail = await getTranslations("venuesCatalog.detail");
  const tNav = await getTranslations("nav");
  const tCrumb = await getTranslations("breadcrumbs");
  const tSurfaces = await getTranslations("venues.detail.courts.surface_options");
  const tStatuses = await getTranslations("venues.detail.courts.status_options");
  const tFormats = await getTranslations("tournamentsPublic");
  const tOpen = await getTranslations("openMatches");
  const tLevels = await getTranslations("levels");
  const dateFmtCompact = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const venue = await loadVenueDetail(id);
  if (!venue) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = user == null;

  let isAdmin = false;
  if (user) {
    const { data: profile } = (await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()) as { data: { is_admin: boolean } | null };
    isAdmin = profile?.is_admin === true;
  }
  const canEdit = user != null && (venue.created_by === user.id || isAdmin);

  const comments = await loadVenueComments(id);

  const mapsHref =
    venue.lat != null && venue.lng != null
      ? `https://www.google.com/maps?q=${venue.lat},${venue.lng}`
      : venue.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${venue.name} ${venue.address ?? ""} ${venue.city ?? ""}`,
          )}`
        : null;

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const jsonLd = buildVenueJsonLd({
    id,
    locale,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    lat: venue.lat,
    lng: venue.lng,
  });

  // -------------------------------------------------------------------------
  // Tab content blocks.
  // -------------------------------------------------------------------------

  const courtsTab = (
    <Surface variant="card" as="section">
      <h2 className="section-title text-[18px] md:text-[20px]">{tDetail("courts.title")}</h2>
      {venue.courts.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">{tDetail("courts.empty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100 overflow-hidden rounded-lg ring-1 ring-ink-100">
          {venue.courts.map((c) => {
            const dot = c.surface ? SURFACE_DOT[c.surface] : "bg-ink-300";
            const isMaint = c.status === "maintenance";
            return (
              <li
                key={c.id}
                className={
                  "flex items-center gap-3 px-4 py-2 text-sm " +
                  (isMaint ? "bg-ink-50/40 text-ink-500" : "text-ink-800")
                }
              >
                <span className="w-8 font-mono tabular-nums text-ink-500">#{c.number}</span>
                <span className="flex-1 truncate">{c.name ?? "—"}</span>
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                    (c.is_indoor ? "bg-grass-100 text-grass-800" : "bg-ball-100 text-ball-800")
                  }
                  aria-label={c.is_indoor ? t("indoor") : t("outdoor")}
                >
                  {c.is_indoor ? (
                    <Building2 className="h-3 w-3" />
                  ) : (
                    <CloudSun className="h-3 w-3" />
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12px]">
                  <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
                  {c.surface ? tSurfaces(c.surface) : "—"}
                </span>
                {isMaint && (
                  <span className="rounded-full bg-clay-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-clay-700">
                    {tStatuses("maintenance")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );

  const openMatchesTab = (
    <Surface variant="card" as="section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title text-[18px] md:text-[20px]">
          {tDetail("open_matches.title")}
        </h2>
        <Button asChild variant="primary" size="sm">
          <Link
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            href={(isGuest ? "/login" : `/open-matches/new?venue=${venue.id}`) as any}
          >
            {isGuest
              ? tDetail("open_matches.empty_cta_guest")
              : tDetail("open_matches.empty_cta_authed")}
          </Link>
        </Button>
      </div>
      {venue.open_matches.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={tDetail("open_matches.empty_title")}
            description={tDetail("open_matches.empty_body")}
            ctaHref={isGuest ? `/${locale}/login` : `/${locale}/open-matches/new?venue=${venue.id}`}
            ctaLabel={
              isGuest
                ? tDetail("open_matches.empty_cta_guest")
                : tDetail("open_matches.empty_cta_authed")
            }
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {venue.open_matches.map((om) => (
            <li key={om.id} className="surface-row lift-on-hover">
              <Link
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                href={`/open-matches/${om.id}` as any}
                className="block space-y-1"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-sm font-semibold text-ink-900">
                    {om.creator_name ?? "—"}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-ink-500">
                    {om.creator_elo}
                  </span>
                  <LevelBadge elo={om.creator_elo} showRange={false} />
                  <span className="rounded-full bg-grass-50 px-2 py-0.5 text-[11px] font-medium text-grass-800">
                    {tOpen(om.format === "singles" ? "format_singles" : "format_doubles")}
                  </span>
                </div>
                <p className="text-xs text-ink-600">
                  {dateFmtCompact.format(new Date(om.starts_at))}
                  <span className="text-ink-400"> · </span>
                  {tOpen("duration_short", { min: om.duration_min })}
                  {om.level_band !== "any" && (
                    <>
                      <span className="text-ink-400"> · </span>
                      <span>{tLevels(om.level_band)}</span>
                    </>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );

  const tournamentsTab = (
    <Surface variant="card" as="section">
      <h2 className="section-title text-[18px] md:text-[20px]">{tDetail("tournaments.title")}</h2>
      {venue.tournaments.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={tDetail("tournaments.empty_title")}
            description={tDetail("tournaments.empty_body")}
            ctaHref={
              isGuest ? `/${locale}/login` : `/${locale}/coach/tournaments/new?venue=${venue.id}`
            }
            ctaLabel={
              isGuest
                ? tDetail("tournaments.empty_cta_guest")
                : tDetail("tournaments.empty_cta_authed")
            }
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {venue.tournaments.map((tnm) => {
            let formatLabel: string;
            try {
              formatLabel = tFormats(`format.${tnm.format}` as never);
            } catch {
              formatLabel = tnm.format;
            }
            return (
              <li
                key={tnm.id}
                className="flex flex-col gap-2 rounded-lg border border-ink-100 bg-white p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="truncate font-display text-base font-semibold text-ink-900">
                      {tnm.name}
                    </h3>
                    {tnm.surface && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-[11px] text-ink-700 ring-1 ring-ink-100">
                        <span
                          aria-hidden
                          className={`h-2 w-2 rounded-full ${SURFACE_DOT[tnm.surface]}`}
                        />
                        {tSurfaces(tnm.surface)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {tDetail("tournaments.starts_on", {
                        date: dateFmt.format(new Date(tnm.starts_on)),
                      })}
                    </span>
                    <span>{tDetail("tournaments.format_label", { format: formatLabel })}</span>
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    href={`/tournaments/${tnm.id}` as any}
                  >
                    {tDetail("tournaments.open_tournament")}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );

  const tabs = [
    { id: "courts", label: tDetail("tabs.courts"), content: courtsTab, count: venue.courts.length },
    {
      id: "open-matches",
      label: tDetail("tabs.open_matches"),
      content: openMatchesTab,
      count: venue.open_matches.length,
    },
    {
      id: "tournaments",
      label: tDetail("tabs.tournaments"),
      content: tournamentsTab,
      count: venue.tournaments.length,
    },
  ];

  return (
    <div className="page-shell space-y-6">
      <JsonLdScript data={jsonLd} />
      <Breadcrumbs
        locale={locale}
        items={[
          { name: tCrumb("home"), path: "" },
          { name: tNav("venues"), path: "/venues" },
          { name: venue.name, path: `/venues/${id}` },
        ]}
      />
      <Link
        href="/venues"
        className="inline-flex items-center gap-1 text-sm text-ink-600 transition hover:text-grass-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {tDetail("back")}
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-grass-100 text-grass-800">
          <Building2 className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={
              <>
                {venue.name}
                <IndoorStatusBadge
                  status={venue.indoor_status}
                  label={t(venue.indoor_status as never)}
                />
              </>
            }
            subtitle={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {(venue.city || venue.district_name) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-ink-400" />
                    {[venue.city, venue.district_name].filter(Boolean).join(" · ")}
                  </span>
                )}
                {venue.address && <span className="text-ink-500">{venue.address}</span>}
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-grass-700 hover:underline"
                  >
                    {t("open_in_maps")}
                  </a>
                )}
                {venue.website && (
                  <a
                    href={venue.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-grass-700 hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {tDetail("website")}
                  </a>
                )}
                {venue.phone && (
                  <a
                    href={`tel:${venue.phone.replace(/[^+\d]/g, "")}`}
                    className="inline-flex items-center gap-1 text-ink-600 hover:text-grass-700"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {venue.phone}
                  </a>
                )}
                <span className="inline-flex items-center gap-2 text-xs text-ink-500">
                  <Sparkles className="h-3 w-3" />
                  {tDetail("courts_count", { n: venue.courts.length })}
                  {venue.tournaments.length > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {venue.tournaments.length}
                      </span>
                    </>
                  )}
                </span>
              </span>
            }
            help={
              <HelpPanel
                pageId={`venue-detail-${venue.id}`}
                variant="inline"
                why={t("help.why")}
                what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
                result={[t("help.result.1"), t("help.result.2")]}
              />
            }
            actions={
              canEdit ? (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    href={`/venues/${venue.id}/edit` as any}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {tDetail("edit_venue")}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>

      {venue.photos.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={venue.photos[0]}
          alt={venue.name}
          className="h-48 w-full rounded-xl2 border border-ink-100 object-cover sm:h-64"
        />
      )}

      <VenueTabs defaultTab="courts" tabs={tabs} />

      <VenueComments
        venueId={venue.id}
        comments={comments}
        currentUserId={user?.id ?? null}
        isAdmin={isAdmin}
      />
    </div>
  );
}
