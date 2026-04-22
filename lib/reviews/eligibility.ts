// =============================================================================
// Pure helpers for "can this player review this coach?"
//
// Rules (anti-fraud):
//   1. Player must have at least one confirmed interaction with the coach:
//      – a confirmed booking on a slot owned by the coach, OR
//      – participation in a tournament owned by the coach (registered).
//   2. Player can submit at most one review per source (booking / tournament).
//   3. Player cannot review themselves (handled separately by the caller).
//
// We keep these helpers pure so they can be exercised by Vitest without
// reaching into Supabase mocks.
// =============================================================================

export type InteractionRow = {
  /** "booking" or "tournament" — what proves the interaction. */
  source_type: "booking" | "tournament";
  /** UUID of that booking or tournament. */
  source_id: string;
  /** Coach the interaction is with. */
  coach_id: string;
  /** When that interaction happened — used for "must be in the past" gating. */
  occurred_at: string | null;
};

export type ExistingReviewRow = {
  source_type: "booking" | "tournament" | "manual" | "open";
  source_id: string | null;
  coach_id: string;
  status: "published" | "hidden" | "flagged" | "removed";
};

export type ReviewEligibility = {
  /** Coach the entry is about. */
  coach_id: string;
  /**
   * What proves (or grants) the right to review:
   *   - `booking`/`tournament` — the player has a confirmed past interaction
   *   - `open` — any signed-in viewer (no proof required, source_id is null)
   */
  source_type: "booking" | "tournament" | "open";
  /** UUID of the proving interaction; null when `source_type === 'open'`. */
  source_id: string | null;
  /** True when a non-removed review already exists for that source. */
  has_existing_review: boolean;
  /** Existing review status if any (so the UI can hint at moderation). */
  existing_status: ExistingReviewRow["status"] | null;
};

const REMOVED_STATUSES = new Set<ExistingReviewRow["status"]>(["removed"]);

/**
 * For a given list of past interactions and the player's existing reviews,
 * return one entry per coach indicating whether the player can write (or
 * update) a review and which interaction proves the relationship.
 *
 * If the player has multiple eligible interactions with the same coach we
 * pick the most recent one (highest occurred_at, ties broken by source_id).
 */
export function computeReviewEligibility(
  interactions: InteractionRow[],
  existingReviews: ExistingReviewRow[],
  now: Date = new Date(),
): ReviewEligibility[] {
  const past = interactions.filter((i) => {
    if (i.occurred_at == null) return false;
    return new Date(i.occurred_at).getTime() <= now.getTime();
  });

  // Group by coach, pick the freshest interaction.
  const bestByCoach = new Map<string, InteractionRow>();
  for (const i of past) {
    const cur = bestByCoach.get(i.coach_id);
    if (
      !cur ||
      (i.occurred_at ?? "") > (cur.occurred_at ?? "") ||
      ((i.occurred_at ?? "") === (cur.occurred_at ?? "") &&
        i.source_id > cur.source_id)
    ) {
      bestByCoach.set(i.coach_id, i);
    }
  }

  // Index existing reviews by (coach_id + source).
  const reviewIndex = new Map<string, ExistingReviewRow>();
  for (const r of existingReviews) {
    if (REMOVED_STATUSES.has(r.status)) continue;
    if (!r.source_id) continue;
    reviewIndex.set(`${r.coach_id}|${r.source_type}|${r.source_id}`, r);
  }

  const out: ReviewEligibility[] = [];
  for (const [coach_id, i] of bestByCoach) {
    const k = `${coach_id}|${i.source_type}|${i.source_id}`;
    const existing = reviewIndex.get(k) ?? null;
    out.push({
      coach_id,
      source_type: i.source_type,
      source_id: i.source_id,
      has_existing_review: existing !== null,
      existing_status: existing?.status ?? null,
    });
  }
  return out;
}

/**
 * Aggregate stars for a coach into an avg + count, ignoring non-published
 * reviews. Useful client-side after a fresh write to avoid an extra round-trip.
 */
export function aggregateCoachStars(
  reviews: Array<{ stars: number; status: ExistingReviewRow["status"] }>,
): { avg: number | null; count: number } {
  const visible = reviews.filter((r) => r.status === "published");
  if (visible.length === 0) return { avg: null, count: 0 };
  const sum = visible.reduce((acc, r) => acc + r.stars, 0);
  return { avg: Math.round((sum / visible.length) * 100) / 100, count: visible.length };
}
