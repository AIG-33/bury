// =============================================================================
// Pure helpers for ranking coaches in /coaches.
//
// We use a Bayesian-shrunk average so a coach with 50 reviews @ 4.85
// outranks a coach with 1 review @ 5.0. The formula:
//
//   weighted = (C * m + R * v) / (C + v)
//
// where:
//   v = number of reviews
//   R = coach's actual average
//   m = global mean across all rated coaches
//   C = shrinkage constant (more = stronger pull toward mean)
//
// This is the IMDB-style top-N method, popular for "is the rating trustworthy?"
// type rankings.
// =============================================================================

export type CoachLeaderboardInput = {
  id: string;
  coach_avg_rating: number | null;
  coach_reviews_count: number;
};

export type CoachLeaderboardScore = CoachLeaderboardInput & {
  /** Bayesian-shrunk average; null when the coach has no reviews. */
  weighted_score: number | null;
  /** True when reviews_count ≥ MIN_REVIEWS_FOR_BADGE — qualifies for podium. */
  qualifies: boolean;
};

export const MIN_REVIEWS_FOR_BADGE = 5;
export const SHRINKAGE_C = 5;

/**
 * Compute the global mean across all rated coaches.
 * Coaches without reviews are skipped (we can't average nothing).
 */
export function globalMean(coaches: CoachLeaderboardInput[]): number {
  const rated = coaches.filter(
    (c) => c.coach_avg_rating != null && c.coach_reviews_count > 0,
  );
  if (rated.length === 0) return 4; // sane default before any data
  const sum = rated.reduce(
    (acc, c) => acc + (c.coach_avg_rating ?? 0) * c.coach_reviews_count,
    0,
  );
  const totalReviews = rated.reduce((acc, c) => acc + c.coach_reviews_count, 0);
  return sum / totalReviews;
}

/**
 * Apply the Bayesian average to every coach. Coaches with no reviews get
 * `weighted_score = null` so the UI can sort them last.
 */
export function rankCoaches(
  coaches: CoachLeaderboardInput[],
): CoachLeaderboardScore[] {
  const m = globalMean(coaches);
  return coaches.map((c) => {
    if (c.coach_avg_rating == null || c.coach_reviews_count === 0) {
      return { ...c, weighted_score: null, qualifies: false };
    }
    const weighted =
      (SHRINKAGE_C * m + c.coach_avg_rating * c.coach_reviews_count) /
      (SHRINKAGE_C + c.coach_reviews_count);
    return {
      ...c,
      weighted_score: Math.round(weighted * 1000) / 1000,
      qualifies: c.coach_reviews_count >= MIN_REVIEWS_FOR_BADGE,
    };
  });
}

export type SortKey = "weighted" | "raw" | "popular";

/**
 * Sort coaches according to the chosen key. We always push coaches without
 * reviews to the bottom and break ties on review count then id for stability.
 */
export function sortCoaches(
  coaches: CoachLeaderboardScore[],
  key: SortKey,
): CoachLeaderboardScore[] {
  const arr = [...coaches];
  arr.sort((a, b) => {
    const aHasReviews = a.coach_reviews_count > 0;
    const bHasReviews = b.coach_reviews_count > 0;
    if (aHasReviews !== bHasReviews) return aHasReviews ? -1 : 1;

    if (key === "popular") {
      if (b.coach_reviews_count !== a.coach_reviews_count) {
        return b.coach_reviews_count - a.coach_reviews_count;
      }
      return (b.coach_avg_rating ?? 0) - (a.coach_avg_rating ?? 0);
    }

    if (key === "raw") {
      const ar = a.coach_avg_rating ?? 0;
      const br = b.coach_avg_rating ?? 0;
      if (br !== ar) return br - ar;
      return b.coach_reviews_count - a.coach_reviews_count;
    }

    // weighted
    const aw = a.weighted_score ?? -Infinity;
    const bw = b.weighted_score ?? -Infinity;
    if (bw !== aw) return bw - aw;
    return b.coach_reviews_count - a.coach_reviews_count;
  });
  // Final stable tie-break on id.
  return arr;
}

/**
 * Return the podium — top N qualifying coaches by weighted score.
 * Coaches that don't reach MIN_REVIEWS_FOR_BADGE are excluded so the
 * podium stays trustworthy.
 */
export function podium(
  coaches: CoachLeaderboardScore[],
  n = 3,
): CoachLeaderboardScore[] {
  return sortCoaches(
    coaches.filter((c) => c.qualifies),
    "weighted",
  ).slice(0, n);
}
