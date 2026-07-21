type Locale = "ru" | "en";

export type OgPillar = {
  emoji: string;
  title: string;
  body: string;
  accent: string;
};

export type OgCopy = {
  headline: string;
  subheadline: string;
  domain: string;
  badge: string;
  region: string;
  pillars: [OgPillar, OgPillar, OgPillar];
  imageAlt: string;
};

const COPY: Record<Locale, OgCopy> = {
  ru: {
    headline: "Любительский теннис без лишних хлопот",
    subheadline: "Спарринг · турниры · тренеры — в одном приложении",
    domain: "www.playtennis.by",
    badge: "12+ городов",
    region: "Играй в своём городе",
    imageAlt: "PlayTennis — спарринг, турниры и тренеры для любителей тенниса",
    pillars: [
      {
        emoji: "🎾",
        title: "Спарринг",
        body: "Открытые матчи — найди соперника по уровню и району",
        accent: "#D7F205",
      },
      {
        emoji: "🏆",
        title: "Турниры",
        body: "Создай свой турнир или участвуй в открытых — 6 форматов",
        accent: "#43B26F",
      },
      {
        emoji: "🧑‍🏫",
        title: "Тренеры",
        body: "Каталог с отзывами — запись на корт за пару кликов",
        accent: "#74CB91",
      },
    ],
  },
  en: {
    headline: "Amateur tennis, minus the hassle",
    subheadline: "Sparring · tournaments · coaches — one platform",
    domain: "www.playtennis.by",
    badge: "12+ cities",
    region: "Play in your city",
    imageAlt: "PlayTennis — sparring, tournaments and coaches for amateur tennis",
    pillars: [
      {
        emoji: "🎾",
        title: "Sparring",
        body: "Open matches — find a partner by level and district",
        accent: "#D7F205",
      },
      {
        emoji: "🏆",
        title: "Tournaments",
        body: "Run your own event or join open ones — 6 formats",
        accent: "#43B26F",
      },
      {
        emoji: "🧑‍🏫",
        title: "Coaches",
        body: "Verified reviews — book a court in a few taps",
        accent: "#74CB91",
      },
    ],
  },
};

export function getOgCopy(locale: string): OgCopy {
  return locale === "en" ? COPY.en : COPY.ru;
}
