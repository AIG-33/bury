import type { Metadata } from "next";
import { getOgImageAlt } from "./og-image";
import {
  CITY_KEYWORDS_EN,
  CITY_KEYWORDS_RU,
  localeOgImagePath,
  LOCALES,
  SITE_NAME,
  SITE_URL,
} from "./site";

type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = "ru";

export type PageMetadataInput = {
  locale: string;
  /** Page title without the site suffix — root layout template adds " · PlayTennis.by". */
  title: string;
  description: string;
  /** Path after locale, e.g. `/coaches` or `/tournaments/abc`. */
  path: string;
  /** Optional extra keywords for this page. */
  keywords?: string[];
  /** Set false for thin or duplicate pages. */
  index?: boolean;
  ogType?: "website" | "article";
  ogImage?: string;
};

function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/** hreflang alternates for ru/en with x-default → default locale (ru). */
export function buildLocaleAlternates(
  path: string,
  locale: string = DEFAULT_LOCALE,
): NonNullable<Metadata["alternates"]> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const canonicalLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const languages: Record<string, string> = {};
  for (const loc of LOCALES) {
    languages[loc] = `/${loc}${normalized}`;
  }
  languages["x-default"] = `/${DEFAULT_LOCALE}${normalized}`;
  return {
    canonical: `/${canonicalLocale}${normalized}`,
    languages,
  };
}

export function tennisKeywords(locale: string): string[] {
  const cities = locale === "en" ? [...CITY_KEYWORDS_EN] : [...CITY_KEYWORDS_RU];

  if (locale === "en") {
    return [
      "amateur tennis",
      "find tennis partner",
      "tennis coach",
      "tennis tournaments",
      "sparring partner tennis",
      "organize tennis match",
      SITE_NAME,
      ...cities.map((c) => `tennis ${c}`),
    ];
  }

  return [
    "любительский теннис",
    "найти партнёра для тенниса",
    "спарринг теннис",
    "тренер по теннису",
    "теннисные турниры",
    "открытые матчи теннис",
    SITE_NAME,
    ...cities.map((c) => `теннис ${c}`),
  ];
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const locale = isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const pagePath = path === "/" ? "" : path;
  const url = `${SITE_URL}/${locale}${pagePath}`;
  const ogImage = input.ogImage ?? localeOgImagePath(locale);
  const ogImageUrl = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;
  const keywords = [...tennisKeywords(locale), ...(input.keywords ?? [])];
  const index = input.index !== false;

  const ogLocale = locale === "en" ? "en_US" : "ru_BY";
  const ogAlternate = locale === "en" ? ["ru_BY"] : ["en_US"];

  return {
    title: input.title,
    description: input.description,
    keywords,
    alternates: buildLocaleAlternates(path, locale),
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: input.ogType ?? "website",
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: ogLocale,
      alternateLocale: ogAlternate,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: input.ogImage ? SITE_NAME : getOgImageAlt(locale),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [ogImageUrl],
    },
  };
}

/** Root-level defaults when a page does not override metadata. */
export function buildRootMetadata(locale: string): Metadata {
  const isEn = locale === "en";
  return buildPageMetadata({
    locale,
    path: "/",
    title: isEn
      ? "Find a sparring partner, coach and tennis tournament"
      : "Найди соперника, тренера и турнир по теннису",
    description: isEn
      ? "Open amateur tennis platform: find a sparring partner by level and location, book a coach, join tournaments or run your own — in minutes."
      : "Открытая платформа любительского тенниса: находите спарринг-партнёра по уровню и городу, выбирайте тренера, записывайтесь в турниры или создавайте свой.",
    keywords: isEn
      ? ["PlayTennis", "amateur tennis community"]
      : ["ПлейТеннис", "сообщество любителей тенниса"],
  });
}
