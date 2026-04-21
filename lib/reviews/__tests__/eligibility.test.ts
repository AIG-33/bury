import { describe, expect, it } from "vitest";
import {
  aggregateCoachStars,
  computeReviewEligibility,
  type ExistingReviewRow,
  type InteractionRow,
} from "../eligibility";

const past = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();
const future = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString();

describe("computeReviewEligibility", () => {
  it("returns one entry per coach with the latest interaction", () => {
    const interactions: InteractionRow[] = [
      { coach_id: "c1", source_type: "booking", source_id: "b1", occurred_at: past(10) },
      { coach_id: "c1", source_type: "booking", source_id: "b2", occurred_at: past(2) },
      { coach_id: "c2", source_type: "tournament", source_id: "t1", occurred_at: past(5) },
    ];
    const out = computeReviewEligibility(interactions, []);
    const c1 = out.find((e) => e.coach_id === "c1")!;
    expect(c1.source_id).toBe("b2");
    expect(out).toHaveLength(2);
  });

  it("skips interactions in the future (slot booked but not yet played)", () => {
    const out = computeReviewEligibility(
      [
        { coach_id: "c1", source_type: "booking", source_id: "b1", occurred_at: future(2) },
      ],
      [],
    );
    expect(out).toHaveLength(0);
  });

  it("flags coaches that already have a review for that source", () => {
    const interactions: InteractionRow[] = [
      { coach_id: "c1", source_type: "booking", source_id: "b1", occurred_at: past(1) },
    ];
    const reviews: ExistingReviewRow[] = [
      { coach_id: "c1", source_type: "booking", source_id: "b1", status: "published" },
    ];
    const out = computeReviewEligibility(interactions, reviews);
    expect(out[0].has_existing_review).toBe(true);
    expect(out[0].existing_status).toBe("published");
  });

  it("treats removed reviews as non-existent so the player can re-submit", () => {
    const interactions: InteractionRow[] = [
      { coach_id: "c1", source_type: "booking", source_id: "b1", occurred_at: past(1) },
    ];
    const reviews: ExistingReviewRow[] = [
      { coach_id: "c1", source_type: "booking", source_id: "b1", status: "removed" },
    ];
    const out = computeReviewEligibility(interactions, reviews);
    expect(out[0].has_existing_review).toBe(false);
  });
});

describe("aggregateCoachStars", () => {
  it("computes avg with 2-decimal rounding", () => {
    const r = aggregateCoachStars([
      { stars: 5, status: "published" },
      { stars: 4, status: "published" },
      { stars: 4, status: "published" },
    ]);
    expect(r.avg).toBe(4.33);
    expect(r.count).toBe(3);
  });

  it("ignores non-published statuses", () => {
    const r = aggregateCoachStars([
      { stars: 5, status: "published" },
      { stars: 1, status: "hidden" },
      { stars: 1, status: "removed" },
    ]);
    expect(r.avg).toBe(5);
    expect(r.count).toBe(1);
  });

  it("returns null avg when no visible reviews", () => {
    const r = aggregateCoachStars([{ stars: 5, status: "removed" }]);
    expect(r.avg).toBeNull();
    expect(r.count).toBe(0);
  });
});
