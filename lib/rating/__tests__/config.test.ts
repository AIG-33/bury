import { describe, it, expect } from "vitest";
import {
  algorithmConfigToRatingConfig,
  ratingConfigFromRow,
} from "../config";
import { DEFAULT_RATING_CONFIG } from "../elo";
import { DEFAULT_ALGORITHM_CONFIG } from "@/lib/quiz/schema";

describe("algorithmConfigToRatingConfig", () => {
  it("maps the default DB config onto the default engine config", () => {
    const cfg = algorithmConfigToRatingConfig(DEFAULT_ALGORITHM_CONFIG);
    expect(cfg).toEqual(DEFAULT_RATING_CONFIG);
  });

  it("carries admin-edited K-factors and multipliers into the engine", () => {
    const cfg = algorithmConfigToRatingConfig({
      ...DEFAULT_ALGORITHM_CONFIG,
      k_factors: {
        provisional: 50,
        intermediate: 28,
        established: 18,
        provisional_until_n_matches: 8,
        intermediate_until_n_matches: 30,
      },
      multipliers: { friendly: 0.25, tournament: 1.1, tournament_final: 1.5 },
    });
    expect(cfg.k_provisional).toBe(50);
    expect(cfg.k_intermediate).toBe(28);
    expect(cfg.k_established).toBe(18);
    expect(cfg.provisional_threshold).toBe(8);
    expect(cfg.multipliers.friendly).toBe(0.25);
    expect(cfg.multipliers.tournament).toBe(1.1);
    expect(cfg.multipliers.tournament_final).toBe(1.5);
    // League mirrors the tournament multiplier (no dedicated DB field).
    expect(cfg.multipliers.league).toBe(1.1);
    // Elite K derived from established (min 8).
    expect(cfg.k_elite).toBe(Math.max(8, Math.round(18 * 0.8)));
  });
});

describe("ratingConfigFromRow", () => {
  it("parses a valid JSONB payload", () => {
    const cfg = ratingConfigFromRow(DEFAULT_ALGORITHM_CONFIG);
    expect(cfg).toEqual(DEFAULT_RATING_CONFIG);
  });

  it("falls back to DEFAULT_RATING_CONFIG for null", () => {
    expect(ratingConfigFromRow(null)).toEqual(DEFAULT_RATING_CONFIG);
  });

  it("falls back to DEFAULT_RATING_CONFIG for a malformed payload", () => {
    expect(ratingConfigFromRow({ k_factors: { provisional: "lots" } })).toEqual(
      DEFAULT_RATING_CONFIG,
    );
    expect(ratingConfigFromRow("not even an object")).toEqual(DEFAULT_RATING_CONFIG);
  });
});
