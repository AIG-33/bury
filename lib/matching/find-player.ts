// =============================================================================
// Find a Player — pure scoring/filtering logic.
//
// We split the algorithm in two halves:
//   1. SQL-side filter: visibility, district(s), Elo range, optional gender / hand.
//      → done in lib/matching/queries.ts (Supabase).
//   2. In-memory ranker: combines Elo distance, availability overlap, district
//      bonus and recency-of-activity into a single 0..1 "match score".
//
// Pure functions here so they're trivially unit-testable.
// =============================================================================

import {
  type Availability,
  type SocialLinks,
  WEEKDAYS,
  TIME_SLOTS,
} from "@/lib/profile/schema";

export type Weekday = (typeof WEEKDAYS)[number];
export type DayPart = (typeof TIME_SLOTS)[number];

export type FindPlayerCandidate = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  district_id: string | null;
  district_name: string | null;
  current_elo: number;
  elo_status: "provisional" | "established";
  rated_matches_count: number;
  dominant_hand: "R" | "L" | null;
  backhand_style: "one_handed" | "two_handed" | null;
  favorite_surface: "hard" | "clay" | "grass" | "carpet" | null;
  whatsapp: string | null;
  telegram_username: string | null;
  social_links: SocialLinks | null;
  availability: Availability | null;
  /** Number of days since last completed match (for recency bonus). */
  days_since_last_match: number | null;
};

export type FindPlayerFilters = {
  /** District UUIDs the user wants to match in. Empty = no district filter. */
  districtIds: string[];
  /** ± Elo radius from the seeker. Default 100. */
  eloRadius: number;
  /** Required overlapping availability slots. Empty = no availability filter. */
  desiredSlots: Array<{ weekday: Weekday; daypart: DayPart }>;
  /** Optional: only show R / L / both. */
  hand: "R" | "L" | "both";
  /** Search by name fragment (case-insensitive). */
  query: string;
};

export const DEFAULT_FILTERS: FindPlayerFilters = {
  districtIds: [],
  eloRadius: 100,
  desiredSlots: [],
  hand: "both",
  query: "",
};

export type ScoredCandidate = FindPlayerCandidate & {
  /** Final 0..100 score used to sort the list. */
  score: number;
  /** How many of the user's wanted slots overlap. */
  overlap_count: number;
  /** Just the overlapping slots, for display in the card. */
  overlap_slots: Array<{ weekday: Weekday; daypart: DayPart }>;
  /** Absolute Elo distance from the seeker. */
  elo_distance: number;
};

export type SeekerContext = {
  id: string;
  current_elo: number;
  district_id: string | null;
  availability: Availability | null;
};

/**
 * Compute pairwise availability overlap.
 * Returns the slots that BOTH the seeker and the candidate marked as "free".
 * If the seeker explicitly listed `desiredSlots`, we further intersect with that.
 */
export function computeOverlap(
  seekerAvailability: Availability | null,
  candidateAvailability: Availability | null,
  desiredSlots: FindPlayerFilters["desiredSlots"],
): Array<{ weekday: Weekday; daypart: DayPart }> {
  if (!candidateAvailability) return [];
  const out: Array<{ weekday: Weekday; daypart: DayPart }> = [];

  for (const wd of WEEKDAYS) {
    const candidateSlots = new Set(candidateAvailability[wd] ?? []);
    if (candidateSlots.size === 0) continue;

    for (const dp of TIME_SLOTS) {
      const candidateHasIt = candidateSlots.has(dp);
      if (!candidateHasIt) continue;

      const seekerHasIt =
        seekerAvailability && (seekerAvailability[wd] ?? []).includes(dp);
      if (!seekerHasIt) continue;

      if (desiredSlots.length > 0) {
        const isWanted = desiredSlots.some(
          (s) => s.weekday === wd && s.daypart === dp,
        );
        if (!isWanted) continue;
      }

      out.push({ weekday: wd, daypart: dp });
    }
  }

  return out;
}

/**
 * Score in 0..100. Higher = better match.
 *
 * Components:
 *   - Elo proximity:        45 pts (linear: 0 distance → 45, eloRadius → 0)
 *   - Availability overlap: 35 pts (saturates at 4 overlapping slots)
 *   - Same district:        10 pts
 *   - Recently active:      10 pts (played in last 30 days)
 *
 * The function is pure — does NOT touch the DB.
 */
export function scoreCandidate(
  candidate: FindPlayerCandidate,
  seeker: SeekerContext,
  filters: FindPlayerFilters,
): ScoredCandidate {
  const eloDistance = Math.abs(candidate.current_elo - seeker.current_elo);
  const eloProximity = Math.max(
    0,
    45 * (1 - eloDistance / Math.max(1, filters.eloRadius)),
  );

  const overlapSlots = computeOverlap(
    seeker.availability,
    candidate.availability,
    filters.desiredSlots,
  );
  const overlapCount = overlapSlots.length;
  // Saturating curve: 0 → 0, 1 → 14, 2 → 23, 3 → 30, 4+ → 35
  const overlapPts = Math.min(35, Math.round(35 * (1 - Math.exp(-overlapCount / 1.7))));

  const districtPts =
    seeker.district_id &&
    candidate.district_id &&
    seeker.district_id === candidate.district_id
      ? 10
      : 0;

  const recencyPts =
    candidate.days_since_last_match != null && candidate.days_since_last_match <= 30
      ? 10
      : 0;

  const total = Math.round(eloProximity + overlapPts + districtPts + recencyPts);

  return {
    ...candidate,
    score: Math.max(0, Math.min(100, total)),
    overlap_count: overlapCount,
    overlap_slots: overlapSlots,
    elo_distance: eloDistance,
  };
}

/**
 * Apply filters that are awkward in SQL (availability overlap, name search,
 * hand intersection when seeker requests "both") and rank by score.
 *
 * Excludes the seeker themselves and anyone they have a pending proposal with.
 */
export function rankCandidates(
  candidates: FindPlayerCandidate[],
  seeker: SeekerContext,
  filters: FindPlayerFilters,
  excludeIds: Set<string> = new Set(),
): ScoredCandidate[] {
  const q = filters.query.trim().toLowerCase();

  return candidates
    .filter((c) => c.id !== seeker.id && !excludeIds.has(c.id))
    .filter((c) => {
      if (filters.hand !== "both" && c.dominant_hand && c.dominant_hand !== filters.hand) {
        return false;
      }
      if (q.length > 0) {
        const name = (c.display_name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    })
    .map((c) => scoreCandidate(c, seeker, filters))
    .filter((c) => {
      // If user explicitly demanded specific slots, hide candidates with zero overlap.
      if (filters.desiredSlots.length > 0 && c.overlap_count === 0) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);
}
