import { describe, it, expect } from "vitest";
import {
  sanitizeHex,
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  readableTextOn,
  resolveScrimOpacity,
  buildRoomTheme,
  INK_TEXT,
  LIGHT_TEXT,
  MIN_SCRIM,
  MAX_SCRIM,
} from "@/lib/tournaments/branding";
import {
  DEFAULT_TOURNAMENT_BRANDING,
  type TournamentBranding,
} from "@/lib/validators/tournament-branding";

describe("sanitizeHex", () => {
  it("accepts valid #RRGGBB and lowercases it", () => {
    expect(sanitizeHex("#ABCDEF")).toBe("#abcdef");
  });
  it("rejects everything else", () => {
    expect(sanitizeHex("red")).toBeNull();
    expect(sanitizeHex("#fff")).toBeNull();
    expect(sanitizeHex(null)).toBeNull();
    // CSS/HTML injection attempts never survive sanitisation.
    expect(sanitizeHex("#fff; background: url(evil)")).toBeNull();
  });
});

describe("hexToRgb / relativeLuminance", () => {
  it("converts and orders luminance black < grey < white", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    const black = relativeLuminance({ r: 0, g: 0, b: 0 });
    const grey = relativeLuminance({ r: 128, g: 128, b: 128 });
    const white = relativeLuminance({ r: 255, g: 255, b: 255 });
    expect(black).toBeLessThan(grey);
    expect(grey).toBeLessThan(white);
    expect(white).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("black vs white is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });
  it("identical colors is 1:1", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });
});

describe("readableTextOn", () => {
  it("uses dark ink on a light background", () => {
    expect(readableTextOn("#ffffff")).toBe(INK_TEXT);
    expect(readableTextOn("#f5f5f0")).toBe(INK_TEXT);
  });
  it("uses light text on a dark background", () => {
    expect(readableTextOn("#101820")).toBe(LIGHT_TEXT);
    expect(readableTextOn("#0f1b14")).toBe(LIGHT_TEXT);
  });
  it("falls back to ink for a missing background", () => {
    expect(readableTextOn(null)).toBe(INK_TEXT);
  });
});

describe("resolveScrimOpacity", () => {
  it("clamps into the legible range", () => {
    expect(resolveScrimOpacity(0)).toBe(MIN_SCRIM);
    expect(resolveScrimOpacity(1)).toBe(MAX_SCRIM);
    expect(resolveScrimOpacity(0.5)).toBe(0.5);
    expect(resolveScrimOpacity(Number.NaN)).toBe(MIN_SCRIM);
  });
});

describe("buildRoomTheme", () => {
  it("is un-themed for the default branding", () => {
    const theme = buildRoomTheme(DEFAULT_TOURNAMENT_BRANDING);
    expect(theme.themed).toBe(false);
    expect(theme.backgroundStyle).toEqual({});
    expect(theme.bannerImageStyle).toBeNull();
  });

  it("builds a gradient when both stops are set", () => {
    const theme = buildRoomTheme({
      ...DEFAULT_TOURNAMENT_BRANDING,
      background_color: "#101820",
      background_gradient_to: "#1f2a36",
    });
    expect(theme.backgroundStyle.background).toContain("linear-gradient");
    expect(theme.textColor).toBe(LIGHT_TEXT); // dark bg → light text
  });

  it("picks a solid background and dark text on a light color", () => {
    const theme = buildRoomTheme({
      ...DEFAULT_TOURNAMENT_BRANDING,
      background_color: "#fefefe",
    });
    expect(theme.backgroundStyle.backgroundColor).toBe("#fefefe");
    expect(theme.textColor).toBe(INK_TEXT);
  });

  it("wraps the banner url in a quoted css url() token", () => {
    const theme = buildRoomTheme({
      ...DEFAULT_TOURNAMENT_BRANDING,
      banner_url: "https://cdn.example.com/b.jpg",
    });
    expect(theme.bannerImageStyle).toBe('url("https://cdn.example.com/b.jpg")');
    expect(theme.themed).toBe(true);
  });

  it("defensively drops an injected non-hex color (defense in depth)", () => {
    // Simulate a malformed value bypassing the Zod layer.
    const evil = {
      ...DEFAULT_TOURNAMENT_BRANDING,
      background_color: "#fff; } body { display:none",
      accent_color: "url(javascript:alert(1))",
    } as unknown as TournamentBranding;
    const theme = buildRoomTheme(evil);
    expect(theme.backgroundStyle).toEqual({});
    expect(theme.accentColor).toBeNull();
  });

  it("maps corner style to a radius class", () => {
    expect(
      buildRoomTheme({ ...DEFAULT_TOURNAMENT_BRANDING, corner_style: "sharp" }).radiusClass,
    ).toBe("rounded-none");
    expect(
      buildRoomTheme({ ...DEFAULT_TOURNAMENT_BRANDING, corner_style: "rounded" }).radiusClass,
    ).toBe("rounded-2xl");
  });
});
