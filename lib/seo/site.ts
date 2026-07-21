export const SITE_NAME = "PlayTennis.by";

/** Canonical production value: `https://www.playtennis.by` (with www). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/** Keep in sync with `i18n/routing.ts` — duplicated here so SEO helpers stay testable without next-intl. */
export const LOCALES = ["ru", "en"] as const;

export const DEFAULT_LOCALE = "ru" as const;

/** ISO 3166-1 alpha-2 — used in JSON-LD and geo hints. */
export const COUNTRY_CODE = "BY";

/** Primary market timezone (also matches next-intl request config). */
export const TIMEZONE = "Europe/Minsk";

export const DEFAULT_OG_IMAGE = "/opengraph-image";

/** Locale-aware OG image path (1200×630 branded card). */
export function localeOgImagePath(locale: string): string {
  return locale === "en" || locale === "ru" ? `/${locale}/opengraph-image` : DEFAULT_OG_IMAGE;
}

/** Cities where the community is active — used as extra SEO keywords. */
export const CITY_KEYWORDS_RU = [
  "Минск",
  "Гродно",
  "Брест",
  "Гомель",
  "Витебск",
  "Могилёв",
  "Бобруйск",
  "Барановичи",
  "Борисов",
  "Пинск",
  "Орша",
  "Мозырь",
  "Солигорск",
  "Лида",
  "Молодечно",
] as const;

export const CITY_KEYWORDS_EN = [
  "Minsk",
  "Grodno",
  "Brest",
  "Gomel",
  "Vitebsk",
  "Mogilev",
  "Bobruisk",
  "Baranavichy",
  "Borisov",
  "Pinsk",
  "Orsha",
  "Mozyr",
  "Soligorsk",
  "Lida",
  "Molodechno",
] as const;
