import { describe, expect, it } from "vitest";
import {
  expectedScore,
  kFactorFor,
  computeMatchEloDelta,
  eloStatusFor,
  DEFAULT_RATING_CONFIG,
} from "../elo";

describe("expectedScore", () => {
  it("returns 0.5 when ratings are equal", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });
  it("favours the higher-rated player", () => {
    expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5);
  });
  it("returns ~0.76 with a 200-point gap", () => {
    expect(expectedScore(1700, 1500)).toBeCloseTo(0.76, 2);
  });
  it("is symmetric: e(a,b) + e(b,a) = 1", () => {
    const e = expectedScore(1234, 1567);
    const inv = expectedScore(1567, 1234);
    expect(e + inv).toBeCloseTo(1, 5);
  });
});

describe("kFactorFor", () => {
  const cfg = DEFAULT_RATING_CONFIG;
  it("uses k_provisional for new players", () => {
    expect(kFactorFor(0, 1000)).toBe(cfg.k_provisional);
    expect(kFactorFor(4, 1500)).toBe(cfg.k_provisional);
  });
  it("uses k_intermediate for established but inexperienced players", () => {
    expect(kFactorFor(5, 1200)).toBe(cfg.k_intermediate);
    expect(kFactorFor(29, 1800)).toBe(cfg.k_intermediate);
  });
  it("uses k_established once a player has 30+ matches", () => {
    expect(kFactorFor(30, 1500)).toBe(cfg.k_established);
    expect(kFactorFor(200, 1500)).toBe(cfg.k_established);
  });
  it("uses k_elite for high-Elo players regardless of matches", () => {
    expect(kFactorFor(50, 2300)).toBe(cfg.k_elite);
  });
});

describe("computeMatchEloDelta", () => {
  it("rewards the winner and penalises the loser symmetrically when Ks are equal", () => {
    const u = computeMatchEloDelta({
      p1Elo: 1500,
      p2Elo: 1500,
      p1Matches: 50,
      p2Matches: 50,
      winnerSide: "p1",
      kind: "tournament",
    });
    expect(u.p1Delta).toBeGreaterThan(0);
    expect(u.p2Delta).toBeLessThan(0);
    expect(u.p1Delta + u.p2Delta).toBe(0);
  });

  it("gives a beginner more upside than a veteran loses (asymmetric K)", () => {
    const u = computeMatchEloDelta({
      p1Elo: 1200,
      p2Elo: 1800,
      p1Matches: 0, // provisional → K=40
      p2Matches: 100, // established → K=20
      winnerSide: "p1",
      kind: "tournament",
    });
    expect(u.p1Delta).toBeGreaterThan(0);
    expect(u.p2Delta).toBeLessThan(0);
    // Beginner gains more (in absolute terms) than veteran loses.
    expect(Math.abs(u.p1Delta)).toBeGreaterThan(Math.abs(u.p2Delta));
  });

  it("scales delta by multiplier (tournament_final > tournament > friendly)", () => {
    const base = (kind: "friendly" | "tournament" | "tournament_final") =>
      computeMatchEloDelta({
        p1Elo: 1500,
        p2Elo: 1500,
        p1Matches: 50,
        p2Matches: 50,
        winnerSide: "p1",
        kind,
      }).p1Delta;
    expect(base("friendly")).toBeLessThan(base("tournament"));
    expect(base("tournament")).toBeLessThan(base("tournament_final"));
  });

  it("never lets Elo drop below floor", () => {
    const u = computeMatchEloDelta({
      p1Elo: 110,
      p2Elo: 2000,
      p1Matches: 100,
      p2Matches: 100,
      winnerSide: "p2",
      kind: "tournament",
    });
    expect(u.p1NewElo).toBeGreaterThanOrEqual(DEFAULT_RATING_CONFIG.floor);
  });

  it("upset gives the underdog a meaningful boost", () => {
    const u = computeMatchEloDelta({
      p1Elo: 1200,
      p2Elo: 1800,
      p1Matches: 100,
      p2Matches: 100,
      winnerSide: "p1",
      kind: "tournament",
    });
    expect(u.p1Delta).toBeGreaterThan(15);
  });

  it("expected outcome gives only a small change", () => {
    const u = computeMatchEloDelta({
      p1Elo: 1800,
      p2Elo: 1200,
      p1Matches: 100,
      p2Matches: 100,
      winnerSide: "p1",
      kind: "tournament",
    });
    expect(u.p1Delta).toBeLessThan(8);
    expect(u.p1Delta).toBeGreaterThanOrEqual(0);
  });
});

describe("eloStatusFor", () => {
  it("flips to established at the threshold", () => {
    expect(eloStatusFor(4)).toBe("provisional");
    expect(eloStatusFor(5)).toBe("established");
  });
});
