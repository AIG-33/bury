import { describe, it, expect } from "vitest";
import {
  ClubBrandingSchema,
  DEFAULT_CLUB_BRANDING,
  clubBrandingFromRow,
  clubBrandingWithLegacy,
  UpdateClubBrandingSchema,
} from "@/lib/validators/club-branding";
import { SponsorSchema } from "@/lib/validators/tournament-branding";

describe("ClubBrandingSchema", () => {
  it("fills defaults from an empty object", () => {
    expect(ClubBrandingSchema.parse({})).toEqual(DEFAULT_CLUB_BRANDING);
  });

  it("accepts a fully-specified valid branding", () => {
    const parsed = ClubBrandingSchema.parse({
      accent_color: "#22C55E",
      banner_url: "https://cdn.example.com/c/banner.jpg",
      tagline: "Играем каждые выходные",
      sponsors: [
        { name: "Head", logo_url: "https://cdn.example.com/s.png", url: "https://head.com" },
      ],
    });
    expect(parsed.accent_color).toBe("#22C55E");
    expect(parsed.sponsors[0]?.url).toBe("https://head.com");
  });

  it("rejects malformed colors and unsafe urls", () => {
    expect(ClubBrandingSchema.safeParse({ accent_color: "green" }).success).toBe(false);
    expect(ClubBrandingSchema.safeParse({ banner_url: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("clubBrandingFromRow", () => {
  it("returns defaults for null / garbage", () => {
    expect(clubBrandingFromRow(null)).toEqual(DEFAULT_CLUB_BRANDING);
    expect(clubBrandingFromRow({ accent_color: "nope" })).toEqual(DEFAULT_CLUB_BRANDING);
  });

  it("parses a valid stored row", () => {
    expect(clubBrandingFromRow({ tagline: "hi" }).tagline).toBe("hi");
  });
});

describe("clubBrandingWithLegacy", () => {
  it("folds legacy brand_color / cover_url into an empty blob", () => {
    const merged = clubBrandingWithLegacy(
      DEFAULT_CLUB_BRANDING,
      "#ff8800",
      "https://cdn.example.com/cover.jpg",
    );
    expect(merged.accent_color).toBe("#ff8800");
    expect(merged.banner_url).toBe("https://cdn.example.com/cover.jpg");
  });

  it("prefers blob values over legacy ones", () => {
    const merged = clubBrandingWithLegacy(
      { ...DEFAULT_CLUB_BRANDING, accent_color: "#123456" },
      "#ff8800",
      null,
    );
    expect(merged.accent_color).toBe("#123456");
  });

  it("ignores malformed legacy values instead of throwing", () => {
    const merged = clubBrandingWithLegacy(
      DEFAULT_CLUB_BRANDING,
      "not-a-color",
      'https://x.com/a.png") ; url(evil',
    );
    expect(merged).toEqual(DEFAULT_CLUB_BRANDING);
  });
});

describe("sponsor url normalization", () => {
  it("prefixes https:// for bare domains", () => {
    const s = SponsorSchema.parse({ name: "Head", logo_url: null, url: "head.com" });
    expect(s.url).toBe("https://head.com");
  });

  it("keeps explicit http(s) urls as-is", () => {
    expect(SponsorSchema.parse({ name: "X", logo_url: null, url: "http://x.by/path" }).url).toBe(
      "http://x.by/path",
    );
  });

  it("normalises empty strings to null", () => {
    expect(SponsorSchema.parse({ name: "X", logo_url: null, url: "  " }).url).toBeNull();
  });

  it("rejects non-web schemes", () => {
    expect(
      SponsorSchema.safeParse({ name: "X", logo_url: null, url: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
});

describe("UpdateClubBrandingSchema", () => {
  it("requires a uuid club_id", () => {
    expect(UpdateClubBrandingSchema.safeParse({ club_id: "nope", branding: {} }).success).toBe(
      false,
    );
  });

  it("accepts a valid payload", () => {
    expect(
      UpdateClubBrandingSchema.safeParse({
        club_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        branding: { accent_color: "#00ff00" },
      }).success,
    ).toBe(true);
  });
});
