import { describe, expect, it } from "vitest";
import { buildTournamentEventJsonLd, serializeJsonLd } from "../json-ld";
import { SITE_NAME, SITE_URL } from "../site";

describe("serializeJsonLd", () => {
  it("escapes < to avoid breaking out of script tags", () => {
    expect(serializeJsonLd({ a: "<script>" })).toBe('{"a":"\\u003cscript>"}');
  });
});

describe("buildTournamentEventJsonLd", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Кубок двора",
    locale: "ru",
    startsOn: "2026-08-01",
    status: "registration",
  };

  it("emits all Google Event recommended fields", () => {
    const ld = buildTournamentEventJsonLd({
      ...base,
      description: "Парный турнир",
      startTime: "10:00:00",
      endsOn: "2026-08-01",
      city: "Минск",
      image: "https://cdn.example.com/banner.jpg",
      entryFeeByn: 25,
      organizerName: "Алекс Бурый",
      performers: [{ name: "Иван" }, { name: "Пётр" }],
    });

    expect(ld["@type"]).toBe("SportsEvent");
    expect(ld.name).toBe("Кубок двора");
    expect(ld.description).toBe("Парный турнир");
    expect(ld.startDate).toBe("2026-08-01T10:00:00");
    expect(ld.endDate).toMatch(/^2026-08-01T/);
    expect(ld.image).toBe("https://cdn.example.com/banner.jpg");
    expect(ld.organizer).toMatchObject({
      "@type": "SportsOrganization",
      name: "Алекс Бурый",
      url: SITE_URL,
    });
    expect(ld.offers).toMatchObject({
      "@type": "Offer",
      price: 25,
      priceCurrency: "BYN",
      availability: "https://schema.org/InStock",
    });
    expect(ld.performer).toEqual([
      { "@type": "Person", name: "Иван" },
      { "@type": "Person", name: "Пётр" },
    ]);
  });

  it("falls back description, image, free offer, and team performer", () => {
    const ld = buildTournamentEventJsonLd(base);

    expect(ld.description).toContain(SITE_NAME);
    expect(String(ld.image)).toMatch(/\/ru\/opengraph-image$/);
    expect(ld.endDate).toBe("2026-08-01");
    expect(ld.offers).toMatchObject({ price: 0, priceCurrency: "BYN" });
    expect(ld.organizer).toMatchObject({ name: SITE_NAME, url: SITE_URL });
    expect(ld.performer).toEqual([
      { "@type": "SportsTeam", name: "Любительские теннисисты" },
    ]);
  });

  it("marks finished events as SoldOut / EventCompleted", () => {
    const ld = buildTournamentEventJsonLd({ ...base, status: "finished" });
    expect(ld.eventStatus).toBe("https://schema.org/EventCompleted");
    expect(ld.offers).toMatchObject({
      availability: "https://schema.org/SoldOut",
    });
  });
});
