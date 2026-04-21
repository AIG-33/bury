import { describe, expect, it } from "vitest";
import {
  globalMean,
  rankCoaches,
  sortCoaches,
  podium,
  MIN_REVIEWS_FOR_BADGE,
  SHRINKAGE_C,
} from "../leaderboard";

describe("globalMean", () => {
  it("falls back to 4 when nobody has reviews", () => {
    expect(
      globalMean([
        { id: "a", coach_avg_rating: null, coach_reviews_count: 0 },
      ]),
    ).toBe(4);
  });

  it("is the review-count weighted mean across rated coaches", () => {
    const m = globalMean([
      { id: "a", coach_avg_rating: 5, coach_reviews_count: 10 },
      { id: "b", coach_avg_rating: 4, coach_reviews_count: 10 },
    ]);
    expect(m).toBeCloseTo(4.5);
  });

  it("ignores coaches with no reviews", () => {
    const m = globalMean([
      { id: "a", coach_avg_rating: 5, coach_reviews_count: 4 },
      { id: "b", coach_avg_rating: null, coach_reviews_count: 0 },
    ]);
    expect(m).toBe(5);
  });
});

describe("rankCoaches", () => {
  it("shrinks small samples toward the global mean", () => {
    // Use a population with a low global mean so a 5★ rookie gets pulled down
    // toward the mean while a 4.9★ veteran with many reviews stays high.
    const ranked = rankCoaches([
      { id: "veteran", coach_avg_rating: 4.9, coach_reviews_count: 50 },
      { id: "rookie", coach_avg_rating: 5.0, coach_reviews_count: 1 },
      { id: "filler1", coach_avg_rating: 3.5, coach_reviews_count: 100 },
      { id: "filler2", coach_avg_rating: 3.8, coach_reviews_count: 80 },
    ]);
    const veteran = ranked.find((r) => r.id === "veteran")!;
    const rookie = ranked.find((r) => r.id === "rookie")!;
    expect(veteran.weighted_score).not.toBeNull();
    expect(rookie.weighted_score).not.toBeNull();
    expect(veteran.weighted_score!).toBeGreaterThan(rookie.weighted_score!);
  });

  it("flags qualifying coaches at the badge threshold", () => {
    const ranked = rankCoaches([
      {
        id: "ok",
        coach_avg_rating: 4.5,
        coach_reviews_count: MIN_REVIEWS_FOR_BADGE,
      },
      {
        id: "few",
        coach_avg_rating: 5,
        coach_reviews_count: MIN_REVIEWS_FOR_BADGE - 1,
      },
    ]);
    expect(ranked.find((r) => r.id === "ok")!.qualifies).toBe(true);
    expect(ranked.find((r) => r.id === "few")!.qualifies).toBe(false);
  });

  it("returns null weighted score for unrated coaches", () => {
    const ranked = rankCoaches([
      { id: "x", coach_avg_rating: null, coach_reviews_count: 0 },
    ]);
    expect(ranked[0].weighted_score).toBeNull();
    expect(ranked[0].qualifies).toBe(false);
  });
});

describe("sortCoaches", () => {
  const sample = rankCoaches([
    { id: "veteran", coach_avg_rating: 4.85, coach_reviews_count: 50 },
    { id: "rookie", coach_avg_rating: 5.0, coach_reviews_count: 1 },
    { id: "popular", coach_avg_rating: 4.6, coach_reviews_count: 80 },
    { id: "unrated", coach_avg_rating: null, coach_reviews_count: 0 },
  ]);

  it("'weighted' surfaces trustworthy averages first", () => {
    const sorted = sortCoaches(sample, "weighted");
    expect(sorted[0].id).toBe("veteran");
    expect(sorted.at(-1)!.id).toBe("unrated");
  });

  it("'raw' lets a 5.0 with one review be #1", () => {
    const sorted = sortCoaches(sample, "raw");
    expect(sorted[0].id).toBe("rookie");
  });

  it("'popular' sorts by review count", () => {
    const sorted = sortCoaches(sample, "popular");
    expect(sorted[0].id).toBe("popular");
  });

  it("always pushes unrated coaches to the bottom", () => {
    for (const k of ["weighted", "raw", "popular"] as const) {
      expect(sortCoaches(sample, k).at(-1)!.id).toBe("unrated");
    }
  });
});

describe("podium", () => {
  it("returns at most N qualifying coaches sorted by weighted score", () => {
    const ranked = rankCoaches([
      { id: "a", coach_avg_rating: 4.9, coach_reviews_count: 30 },
      { id: "b", coach_avg_rating: 4.7, coach_reviews_count: 60 },
      { id: "c", coach_avg_rating: 5.0, coach_reviews_count: 1 }, // not qualifying
      { id: "d", coach_avg_rating: 4.5, coach_reviews_count: 12 },
    ]);
    const top = podium(ranked, 3);
    expect(top).toHaveLength(3);
    expect(top.every((p) => p.qualifies)).toBe(true);
    expect(top[0].id).toBe("a");
  });
});

describe("constants", () => {
  it("shrinkage and badge threshold stay sane", () => {
    expect(SHRINKAGE_C).toBeGreaterThan(0);
    expect(MIN_REVIEWS_FOR_BADGE).toBeGreaterThan(0);
  });
});
