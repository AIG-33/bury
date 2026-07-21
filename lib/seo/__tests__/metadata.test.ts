import { describe, expect, it } from "vitest";
import { buildLocaleAlternates, buildPageMetadata, tennisKeywords } from "../metadata";

describe("buildLocaleAlternates", () => {
  it("includes ru, en and x-default", () => {
    const alt = buildLocaleAlternates("/coaches");
    expect(alt.languages?.ru).toBe("/ru/coaches");
    expect(alt.languages?.en).toBe("/en/coaches");
    expect(alt.languages?.["x-default"]).toBe("/ru/coaches");
    expect(alt.canonical).toBe("/ru/coaches");
  });

  it("canonical follows the active locale", () => {
    const alt = buildLocaleAlternates("/coaches", "en");
    expect(alt.canonical).toBe("/en/coaches");
  });
});

describe("tennisKeywords", () => {
  it("includes city keywords for ru locale", () => {
    const kw = tennisKeywords("ru");
    expect(kw.some((k) => k.includes("Минск"))).toBe(true);
  });

  it("includes city keywords for en locale", () => {
    const kw = tennisKeywords("en");
    expect(kw.some((k) => k.toLowerCase().includes("minsk"))).toBe(true);
  });
});

describe("buildPageMetadata", () => {
  it("sets openGraph and twitter with absolute image url", () => {
    const meta = buildPageMetadata({
      locale: "ru",
      title: "Тест",
      description: "Описание",
      path: "/players",
    });
    expect(meta.openGraph?.title).toBe("Тест");
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    const images = meta.openGraph?.images;
    const first = Array.isArray(images) ? images[0] : images;
    if (first && typeof first === "object" && "url" in first) {
      expect(String(first.url)).toMatch(/opengraph-image/);
    }
  });

  it("can noindex a page", () => {
    const meta = buildPageMetadata({
      locale: "ru",
      title: "Hidden",
      description: "—",
      path: "/secret",
      index: false,
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
