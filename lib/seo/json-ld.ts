import { COUNTRY_CODE, SITE_NAME, SITE_URL, TIMEZONE } from "./site";

/** Escape `<` in JSON-LD script bodies to avoid breaking out of script tags. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    description:
      "Открытая платформа любительского тенниса в Беларуси: спарринг, тренеры, турниры и рейтинг.",
    sport: "Tennis",
    areaServed: {
      "@type": "Country",
      name: "Belarus",
      alternateName: "Беларусь",
    },
    availableLanguage: ["ru", "en"],
  };
}

export function buildWebSiteJsonLd(locale: string) {
  const localePath = `/${locale}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: locale === "en" ? "en" : "ru",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}${localePath}/players?level={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

type VenueJsonLdInput = {
  id: string;
  name: string;
  locale: string;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export function buildVenueJsonLd(venue: VenueJsonLdInput) {
  const url = `${SITE_URL}/${venue.locale}/venues/${venue.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": url,
    name: venue.name,
    url,
    sport: "Tennis",
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.address ?? undefined,
      addressLocality: venue.city ?? undefined,
      addressCountry: COUNTRY_CODE,
    },
    geo:
      venue.lat != null && venue.lng != null
        ? {
            "@type": "GeoCoordinates",
            latitude: venue.lat,
            longitude: venue.lng,
          }
        : undefined,
  };
}

type TournamentJsonLdInput = {
  id: string;
  name: string;
  locale: string;
  description?: string | null;
  startsOn: string;
  startTime?: string | null;
  city?: string | null;
  status: string;
};

export function buildTournamentEventJsonLd(t: TournamentJsonLdInput) {
  const url = `${SITE_URL}/${t.locale}/tournaments/${t.id}`;
  const start = t.startTime ? `${t.startsOn}T${t.startTime}` : t.startsOn;
  const eventStatus =
    t.status === "finished"
      ? "https://schema.org/EventCompleted"
      : t.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled";

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": url,
    name: t.name,
    description: t.description ?? undefined,
    url,
    sport: "Tennis",
    eventStatus,
    startDate: start,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: t.city
      ? {
          "@type": "Place",
          name: t.city,
          address: { "@type": "PostalAddress", addressLocality: t.city, addressCountry: COUNTRY_CODE },
        }
      : {
          "@type": "Place",
          name: "Belarus",
          address: { "@type": "PostalAddress", addressCountry: COUNTRY_CODE },
        },
    organizer: { "@id": `${SITE_URL}/#organization` },
  };
}

type CoachJsonLdInput = {
  id: string;
  locale: string;
  name: string;
  bio?: string | null;
  image?: string | null;
  city?: string | null;
};

export function buildCoachJsonLd(coach: CoachJsonLdInput) {
  const url = `${SITE_URL}/${coach.locale}/coaches/${coach.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": url,
    name: coach.name,
    url,
    image: coach.image ?? undefined,
    description: coach.bio ?? undefined,
    jobTitle: coach.locale === "en" ? "Tennis coach" : "Тренер по теннису",
    knowsAbout: "Tennis",
    worksFor: { "@id": `${SITE_URL}/#organization` },
    workLocation: coach.city
      ? {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: coach.city,
            addressCountry: COUNTRY_CODE,
          },
        }
      : undefined,
  };
}

type ClubJsonLdInput = {
  slug: string;
  locale: string;
  name: string;
  description?: string | null;
  city?: string | null;
  logoUrl?: string | null;
};

export function buildClubJsonLd(club: ClubJsonLdInput) {
  const url = `${SITE_URL}/${club.locale}/clubs/${club.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    "@id": url,
    name: club.name,
    url,
    description: club.description ?? undefined,
    logo: club.logoUrl ?? undefined,
    sport: "Tennis",
    address: club.city
      ? {
          "@type": "PostalAddress",
          addressLocality: club.city,
          addressCountry: COUNTRY_CODE,
        }
      : { "@type": "PostalAddress", addressCountry: COUNTRY_CODE },
  };
}

/** BreadcrumbList for catalogue → detail navigation in SERP. */
export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  locale: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}/${locale}${item.path.startsWith("/") ? item.path : `/${item.path}`}`,
    })),
  };
}

export { TIMEZONE };
