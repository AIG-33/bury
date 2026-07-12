import { describe, it, expect } from "vitest";
import {
  TournamentBrandingSchema,
  DEFAULT_TOURNAMENT_BRANDING,
  tournamentBrandingFromRow,
  hasBranding,
  UpdateTournamentBrandingSchema,
} from "@/lib/validators/tournament-branding";

describe("TournamentBrandingSchema", () => {
  it("fills defaults from an empty object", () => {
    const parsed = TournamentBrandingSchema.parse({});
    expect(parsed).toEqual(DEFAULT_TOURNAMENT_BRANDING);
  });

  it("accepts a fully-specified valid branding", () => {
    const parsed = TournamentBrandingSchema.parse({
      theme_preset: "dark",
      background_color: "#101820",
      background_gradient_to: "#1F2A36",
      accent_color: "#22C55E",
      logo_url: "https://cdn.example.com/t/logo.png",
      banner_url: "https://cdn.example.com/t/banner.jpg",
      banner_overlay_opacity: 0.6,
      corner_style: "sharp",
      font_pairing: "modern",
      title_override: "  Minsk Open  ",
      tagline: "Кубок города",
      sponsors: [{ name: "Head", logo_url: "https://cdn.example.com/s.png", url: null }],
    });
    expect(parsed.background_color).toBe("#101820");
    expect(parsed.title_override).toBe("Minsk Open"); // trimmed
    expect(parsed.sponsors).toHaveLength(1);
  });

  it("rejects a malformed hex color", () => {
    expect(
      TournamentBrandingSchema.safeParse({ accent_color: "red" }).success,
    ).toBe(false);
    expect(
      TournamentBrandingSchema.safeParse({ accent_color: "#12345" }).success,
    ).toBe(false);
  });

  it("normalises empty strings to null for optional colors/urls/text", () => {
    const parsed = TournamentBrandingSchema.parse({
      background_color: "",
      logo_url: "",
      tagline: "   ",
    });
    expect(parsed.background_color).toBeNull();
    expect(parsed.logo_url).toBeNull();
    expect(parsed.tagline).toBeNull();
  });

  it("rejects a javascript: url (scheme injection)", () => {
    expect(
      TournamentBrandingSchema.safeParse({
        banner_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("rejects a url with CSS-breaking characters", () => {
    expect(
      TournamentBrandingSchema.safeParse({
        banner_url: 'https://x.com/a.png") ; background: url(evil',
      }).success,
    ).toBe(false);
    expect(
      TournamentBrandingSchema.safeParse({
        banner_url: "https://x.com/a b.png",
      }).success,
    ).toBe(false);
  });

  it("clamps nothing but rejects out-of-range opacity", () => {
    expect(
      TournamentBrandingSchema.safeParse({ banner_overlay_opacity: 1.5 }).success,
    ).toBe(false);
    expect(
      TournamentBrandingSchema.safeParse({ banner_overlay_opacity: -0.1 }).success,
    ).toBe(false);
    expect(TournamentBrandingSchema.parse({ banner_overlay_opacity: 0.5 }).banner_overlay_opacity).toBe(0.5);
  });

  it("caps sponsors at 12", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({
      name: `S${i}`,
      logo_url: null,
      url: null,
    }));
    expect(TournamentBrandingSchema.safeParse({ sponsors: many }).success).toBe(false);
  });
});

describe("tournamentBrandingFromRow", () => {
  it("returns defaults for null / garbage", () => {
    expect(tournamentBrandingFromRow(null)).toEqual(DEFAULT_TOURNAMENT_BRANDING);
    expect(tournamentBrandingFromRow({ accent_color: "not-a-color" })).toEqual(
      DEFAULT_TOURNAMENT_BRANDING,
    );
  });

  it("parses a valid stored row", () => {
    const b = tournamentBrandingFromRow({ accent_color: "#abcdef", tagline: "hi" });
    expect(b.accent_color).toBe("#abcdef");
    expect(b.tagline).toBe("hi");
  });
});

describe("hasBranding", () => {
  it("is false for the untouched default", () => {
    expect(hasBranding(DEFAULT_TOURNAMENT_BRANDING)).toBe(false);
  });

  it("is true once anything is customised", () => {
    expect(hasBranding({ ...DEFAULT_TOURNAMENT_BRANDING, accent_color: "#123456" })).toBe(true);
    expect(hasBranding({ ...DEFAULT_TOURNAMENT_BRANDING, theme_preset: "dark" })).toBe(true);
  });
});

describe("UpdateTournamentBrandingSchema", () => {
  it("requires a uuid tournament_id", () => {
    expect(
      UpdateTournamentBrandingSchema.safeParse({
        tournament_id: "nope",
        branding: {},
      }).success,
    ).toBe(false);
  });

  it("accepts a valid payload", () => {
    const r = UpdateTournamentBrandingSchema.safeParse({
      tournament_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      branding: { accent_color: "#00ff00" },
    });
    expect(r.success).toBe(true);
  });
});
