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
  /** Calendar end date (`YYYY-MM-DD`). Falls back to `startsOn` when omitted. */
  endsOn?: string | null;
  city?: string | null;
  status: string;
  /** Absolute https image URL (banner / logo / OG fallback). */
  image?: string | null;
  /** Entry fee in BYN; null/0 → free Offer with price 0. */
  entryFeeByn?: number | null;
  /** Human organizer display name (club owner / coach). */
  organizerName?: string | null;
  /** Participant display names used as Event `performer` list. */
  performers?: Array<{ name: string }> | null;
};

/** Build an ISO-8601 / date value Google Event rich results accept as endDate. */
function tournamentEndDate(t: TournamentJsonLdInput, start: string): string {
  if (t.endsOn && t.endsOn !== t.startsOn) return t.endsOn;
  if (t.endsOn) {
    // Same calendar day: if we have a wall-clock start, give a same-day end
    // a few hours later so endDate > startDate (Google warns on equal instants).
    if (t.startTime) {
      const [hh, mm] = t.startTime.split(":").map((x) => Number(x));
      const endH = Math.min(23, (hh || 0) + 6);
      return `${t.endsOn}T${String(endH).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}:00`;
    }
    return t.endsOn;
  }
  if (t.startTime) {
    const [hh, mm] = t.startTime.split(":").map((x) => Number(x));
    const endH = Math.min(23, (hh || 0) + 6);
    return `${t.startsOn}T${String(endH).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}:00`;
  }
  // All-day single-day event — endDate may equal startDate for date-only values.
  return start;
}

export function buildTournamentEventJsonLd(t: TournamentJsonLdInput) {
  const url = `${SITE_URL}/${t.locale}/tournaments/${t.id}`;
  const start = t.startTime ? `${t.startsOn}T${t.startTime}` : t.startsOn;
  const end = tournamentEndDate(t, start);
  const eventStatus =
    t.status === "finished"
      ? "https://schema.org/EventCompleted"
      : t.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled";

  const fallbackDescription =
    t.locale === "en"
      ? `Amateur tennis tournament on ${SITE_NAME}.`
      : `Любительский теннисный турнир на ${SITE_NAME}.`;
  const description = (t.description?.trim() || fallbackDescription) as string;

  const image =
    t.image?.trim() ||
    `${SITE_URL}${t.locale === "en" ? "/en" : "/ru"}/opengraph-image`;

  const price = t.entryFeeByn != null && t.entryFeeByn > 0 ? t.entryFeeByn : 0;
  const availability =
    t.status === "finished" || t.status === "cancelled"
      ? "https://schema.org/SoldOut"
      : "https://schema.org/InStock";

  const namedPerformers = (t.performers ?? [])
    .map((p) => p.name.trim())
    .filter((name) => name.length > 0)
    .slice(0, 32)
    .map((name) => ({ "@type": "Person" as const, name }));

  const performer =
    namedPerformers.length > 0
      ? namedPerformers
      : [
          {
            "@type": "SportsTeam" as const,
            name:
              t.locale === "en"
                ? "Amateur tennis players"
                : "Любительские теннисисты",
          },
        ];

  // Inline name+url — Google does not always resolve bare `@id` references
  // across separate JSON-LD blocks, which surfaces as missing organizer fields.
  const organizer = {
    "@type": "SportsOrganization" as const,
    "@id": `${SITE_URL}/#organization`,
    name: t.organizerName?.trim() || SITE_NAME,
    url: SITE_URL,
  };

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": url,
    name: t.name,
    description,
    url,
    image,
    sport: "Tennis",
    eventStatus,
    startDate: start,
    endDate: end,
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
    organizer,
    offers: {
      "@type": "Offer",
      url,
      price,
      priceCurrency: "BYN",
      availability,
      validFrom: t.startsOn,
    },
    performer,
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
