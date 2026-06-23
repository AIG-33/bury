import { describe, it, expect } from "vitest";
import {
  DEFAULT_CLUB_RATING_CONFIG,
  DEFAULT_CLUB_PAGE_BLOCKS,
  clubRatingConfigFromRow,
  clubRatingConfigToRatingConfig,
  clubRatingConfigToEngine,
  clubPageBlocksFromRow,
} from "@/lib/clubs/rating-schema";
import { DEFAULT_RATING_CONFIG, computeMatchEloDelta } from "@/lib/rating/elo";

describe("clubRatingConfigToRatingConfig", () => {
  it("maps defaults to the site engine config (start_rating aside)", () => {
    const engine = clubRatingConfigToRatingConfig(DEFAULT_CLUB_RATING_CONFIG);
    expect(engine.divisor).toBe(DEFAULT_RATING_CONFIG.divisor);
    expect(engine.k_provisional).toBe(DEFAULT_RATING_CONFIG.k_provisional);
    expect(engine.k_intermediate).toBe(DEFAULT_RATING_CONFIG.k_intermediate);
    expect(engine.k_established).toBe(DEFAULT_RATING_CONFIG.k_established);
    expect(engine.provisional_threshold).toBe(
      DEFAULT_RATING_CONFIG.provisional_threshold,
    );
    expect(engine.multipliers.friendly).toBe(
      DEFAULT_RATING_CONFIG.multipliers.friendly,
    );
    expect(engine.multipliers.league).toBe(engine.multipliers.tournament);
  });

  it("honours a custom floor", () => {
    const engine = clubRatingConfigToRatingConfig({
      ...DEFAULT_CLUB_RATING_CONFIG,
      floor: 500,
    });
    expect(engine.floor).toBe(500);
  });

  it("produces the same deltas as the default engine for equal players", () => {
    const cfg = clubRatingConfigToRatingConfig(DEFAULT_CLUB_RATING_CONFIG);
    const withClub = computeMatchEloDelta({
      p1Elo: 1000,
      p2Elo: 1000,
      p1Matches: 0,
      p2Matches: 0,
      winnerSide: "p1",
      kind: "tournament",
      cfg,
    });
    const withDefault = computeMatchEloDelta({
      p1Elo: 1000,
      p2Elo: 1000,
      p1Matches: 0,
      p2Matches: 0,
      winnerSide: "p1",
      kind: "tournament",
      cfg: DEFAULT_RATING_CONFIG,
    });
    expect(withClub.p1Delta).toBe(withDefault.p1Delta);
    expect(withClub.p2Delta).toBe(withDefault.p2Delta);
  });

  it("a higher K-factor yields a larger swing", () => {
    const lowK = clubRatingConfigToRatingConfig(DEFAULT_CLUB_RATING_CONFIG);
    const highK = clubRatingConfigToRatingConfig({
      ...DEFAULT_CLUB_RATING_CONFIG,
      k_factors: { ...DEFAULT_CLUB_RATING_CONFIG.k_factors, established: 80 },
    });
    const base = {
      p1Elo: 1000,
      p2Elo: 1000,
      p1Matches: 50,
      p2Matches: 50,
      winnerSide: "p1" as const,
      kind: "tournament" as const,
    };
    const low = computeMatchEloDelta({ ...base, cfg: lowK });
    const high = computeMatchEloDelta({ ...base, cfg: highK });
    expect(Math.abs(high.p1Delta)).toBeGreaterThan(Math.abs(low.p1Delta));
  });
});

describe("clubRatingConfigFromRow / clubRatingConfigToEngine", () => {
  it("falls back to defaults on garbage", () => {
    expect(clubRatingConfigFromRow(null)).toEqual(DEFAULT_CLUB_RATING_CONFIG);
    expect(clubRatingConfigFromRow({ start_rating: "nonsense" })).toEqual(
      DEFAULT_CLUB_RATING_CONFIG,
    );
    expect(clubRatingConfigToEngine(undefined)).toEqual(DEFAULT_RATING_CONFIG);
  });

  it("parses a valid row", () => {
    const parsed = clubRatingConfigFromRow({
      start_rating: 1200,
      floor: 200,
      k_factors: {
        provisional: 50,
        intermediate: 30,
        established: 18,
        provisional_until_n_matches: 8,
        intermediate_until_n_matches: 40,
      },
      multipliers: { friendly: 0.4, tournament: 1.1, tournament_final: 1.5 },
    });
    expect(parsed.start_rating).toBe(1200);
    expect(parsed.k_factors.provisional).toBe(50);
    expect(parsed.multipliers.tournament_final).toBe(1.5);
  });
});

describe("clubPageBlocksFromRow", () => {
  it("returns all-on by default", () => {
    expect(clubPageBlocksFromRow(null)).toEqual(DEFAULT_CLUB_PAGE_BLOCKS);
  });

  it("merges partial overrides over defaults", () => {
    expect(clubPageBlocksFromRow({ venues: false })).toEqual({
      ...DEFAULT_CLUB_PAGE_BLOCKS,
      venues: false,
    });
  });

  it("ignores unknown keys / bad types", () => {
    expect(clubPageBlocksFromRow({ rating: "yes", bogus: 1 })).toEqual(
      DEFAULT_CLUB_PAGE_BLOCKS,
    );
  });
});
