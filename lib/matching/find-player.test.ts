import { describe, it, expect } from "vitest";
import {
  computeOverlap,
  scoreCandidate,
  rankCandidates,
  type FindPlayerCandidate,
  type SeekerContext,
  type FindPlayerFilters,
} from "./find-player";
import { EMPTY_AVAILABILITY, EMPTY_SOCIAL_LINKS } from "@/lib/profile/schema";

const baseSeeker: SeekerContext = {
  id: "seeker-1",
  current_elo: 1200,
  country: "BY",
  availability: {
    ...EMPTY_AVAILABILITY,
    mon: ["evening"],
    tue: ["evening"],
    wed: ["morning", "evening"],
    sat: ["morning", "noon"],
  },
};

function makeCandidate(overrides: Partial<FindPlayerCandidate>): FindPlayerCandidate {
  return {
    id: "c1",
    display_name: "Test Candidate",
    avatar_url: null,
    city: "Минск",
    country: "BY",
    current_elo: 1200,
    elo_status: "established",
    rated_matches_count: 30,
    dominant_hand: "R",
    backhand_style: "two_handed",
    favorite_surface: "clay",
    whatsapp: "+375291234567",
    telegram_username: null,
    social_links: EMPTY_SOCIAL_LINKS,
    availability: { ...EMPTY_AVAILABILITY, mon: ["evening"], wed: ["evening"] },
    days_since_last_match: 5,
    external_rating: null,
    ...overrides,
  };
}

const noFilters: FindPlayerFilters = {
  country: null,
  eloRadius: 100,
  desiredSlots: [],
  hand: "both",
  query: "",
  ltOnly: false,
  ltEloMin: null,
  ltEloMax: null,
};

describe("computeOverlap", () => {
  it("returns slots that both players share", () => {
    const overlap = computeOverlap(
      baseSeeker.availability,
      { ...EMPTY_AVAILABILITY, mon: ["evening"], wed: ["morning", "evening"], sun: ["evening"] },
      [],
    );
    expect(overlap).toEqual(
      expect.arrayContaining([
        { weekday: "mon", daypart: "evening" },
        { weekday: "wed", daypart: "morning" },
        { weekday: "wed", daypart: "evening" },
      ]),
    );
    expect(overlap).toHaveLength(3);
  });

  it("intersects with desiredSlots when provided", () => {
    const overlap = computeOverlap(
      baseSeeker.availability,
      { ...EMPTY_AVAILABILITY, mon: ["evening"], wed: ["evening"] },
      [{ weekday: "wed", daypart: "evening" }],
    );
    expect(overlap).toEqual([{ weekday: "wed", daypart: "evening" }]);
  });

  it("returns empty array when candidate has no availability", () => {
    expect(computeOverlap(baseSeeker.availability, null, [])).toEqual([]);
  });
});

describe("scoreCandidate", () => {
  it("max-scores a same-Elo, same-country, recently-active candidate with overlap", () => {
    const c = makeCandidate({});
    const scored = scoreCandidate(c, baseSeeker, noFilters);
    // 45 (Elo) + ~23 (2 overlap slots) + 10 (country) + 10 (recency) ≈ 88
    expect(scored.score).toBeGreaterThanOrEqual(80);
    expect(scored.score).toBeLessThanOrEqual(95);
    expect(scored.overlap_count).toBe(2);
    expect(scored.elo_distance).toBe(0);
  });

  it("penalizes far-Elo candidate", () => {
    const c = makeCandidate({ current_elo: 1400 }); // distance = 200, > radius 100
    const scored = scoreCandidate(c, baseSeeker, noFilters);
    // Elo proximity component should be 0 (clamped)
    expect(scored.score).toBeLessThan(50);
  });

  it("gives no country bonus when countries differ", () => {
    const same = scoreCandidate(makeCandidate({}), baseSeeker, noFilters);
    const diff = scoreCandidate(makeCandidate({ country: "PL" }), baseSeeker, noFilters);
    expect(same.score - diff.score).toBeGreaterThanOrEqual(10);
  });

  it("gives no recency bonus when last match was long ago", () => {
    const stale = scoreCandidate(
      makeCandidate({ days_since_last_match: 365 }),
      baseSeeker,
      noFilters,
    );
    const fresh = scoreCandidate(
      makeCandidate({ days_since_last_match: 5 }),
      baseSeeker,
      noFilters,
    );
    expect(fresh.score - stale.score).toBeGreaterThanOrEqual(10);
  });

  // The /me/find?focus=<id> deep link runs `scoreCandidate` against the
  // seeker's defaults without ever filtering by Elo radius — the user
  // already chose this opponent in the public catalogue. This invariant
  // guards against accidental regressions that would silently drop a
  // far-Elo focused player from the page.
  it("returns a valid 0..100 score even when Elo distance is far beyond radius", () => {
    const farUp = scoreCandidate(makeCandidate({ current_elo: 2400 }), baseSeeker, noFilters);
    const farDown = scoreCandidate(makeCandidate({ current_elo: 600 }), baseSeeker, noFilters);
    for (const s of [farUp, farDown]) {
      expect(Number.isFinite(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.id).toBe("c1");
    }
  });
});

describe("rankCandidates", () => {
  it("excludes the seeker from results", () => {
    const ranked = rankCandidates(
      [makeCandidate({ id: "seeker-1" }), makeCandidate({ id: "other" })],
      baseSeeker,
      noFilters,
    );
    expect(ranked.map((c) => c.id)).toEqual(["other"]);
  });

  it("excludes ids from excludeIds", () => {
    const ranked = rankCandidates(
      [makeCandidate({ id: "x" }), makeCandidate({ id: "y" })],
      baseSeeker,
      noFilters,
      new Set(["x"]),
    );
    expect(ranked.map((c) => c.id)).toEqual(["y"]);
  });

  it("filters by hand when set", () => {
    const ranked = rankCandidates(
      [
        makeCandidate({ id: "righty", dominant_hand: "R" }),
        makeCandidate({ id: "lefty", dominant_hand: "L" }),
      ],
      baseSeeker,
      { ...noFilters, hand: "L" },
    );
    expect(ranked.map((c) => c.id)).toEqual(["lefty"]);
  });

  it("hides candidates with zero overlap when desiredSlots are set", () => {
    const ranked = rankCandidates(
      [
        makeCandidate({
          id: "match",
          availability: { ...EMPTY_AVAILABILITY, sat: ["morning"] },
        }),
        makeCandidate({
          id: "miss",
          availability: { ...EMPTY_AVAILABILITY, sun: ["late"] },
        }),
      ],
      baseSeeker,
      { ...noFilters, desiredSlots: [{ weekday: "sat", daypart: "morning" }] },
    );
    expect(ranked.map((c) => c.id)).toEqual(["match"]);
  });

  it("filters by display_name query", () => {
    const ranked = rankCandidates(
      [
        makeCandidate({ id: "a", display_name: "Anna Kowalska" }),
        makeCandidate({ id: "b", display_name: "Piotr Nowak" }),
      ],
      baseSeeker,
      { ...noFilters, query: "kowal" },
    );
    expect(ranked.map((c) => c.id)).toEqual(["a"]);
  });

  it("sorts by score descending", () => {
    const great = makeCandidate({ id: "great" });
    const meh = makeCandidate({ id: "meh", current_elo: 1280, country: "PL" });
    const ranked = rankCandidates([meh, great], baseSeeker, noFilters);
    expect(ranked[0].id).toBe("great");
    expect(ranked[1].id).toBe("meh");
  });

  describe("Liga Tennisa filter", () => {
    const withLt = (id: string, elo: number) =>
      makeCandidate({
        id,
        external_rating: {
          source: "liga_tennisa",
          external_url: `https://www.ligatennisa.com/players/${id}`,
          display_tier: "Legger",
          external_elo: elo,
          external_elo_doubles: null,
          is_calibrating_singles: false,
        },
      });

    it("ltOnly excludes candidates without an LT rating", () => {
      const ranked = rankCandidates(
        [makeCandidate({ id: "no_lt" }), withLt("with_lt", 1500)],
        baseSeeker,
        { ...noFilters, ltOnly: true },
      );
      expect(ranked.map((c) => c.id)).toEqual(["with_lt"]);
    });

    it("ltEloMin/Max narrow the range and imply ltOnly", () => {
      const ranked = rankCandidates(
        [
          makeCandidate({ id: "no_lt" }),
          withLt("low", 1100),
          withLt("mid", 1500),
          withLt("high", 2000),
        ],
        baseSeeker,
        { ...noFilters, ltEloMin: 1400, ltEloMax: 1700 },
      );
      expect(ranked.map((c) => c.id)).toEqual(["mid"]);
    });

    it("only ltEloMin (no max) — open-ended upper bound", () => {
      const ranked = rankCandidates(
        [makeCandidate({ id: "no_lt" }), withLt("low", 1100), withLt("high", 2000)],
        baseSeeker,
        { ...noFilters, ltEloMin: 1500 },
      );
      expect(ranked.map((c) => c.id)).toEqual(["high"]);
    });
  });
});
