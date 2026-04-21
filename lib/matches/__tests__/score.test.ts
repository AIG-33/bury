import { describe, expect, it } from "vitest";
import { hasAnyGames, inferWinnerFromSets } from "../score";

describe("inferWinnerFromSets", () => {
  it("returns null for empty input", () => {
    expect(inferWinnerFromSets([])).toBeNull();
  });

  it("picks the side with more sets won", () => {
    expect(
      inferWinnerFromSets([
        { p1_games: 6, p2_games: 4 },
        { p1_games: 6, p2_games: 3 },
      ]),
    ).toBe("p1");

    expect(
      inferWinnerFromSets([
        { p1_games: 4, p2_games: 6 },
        { p1_games: 7, p2_games: 5 },
        { p1_games: 4, p2_games: 6 },
      ]),
    ).toBe("p2");
  });

  it("uses tiebreak as set tie-breaker when games are equal", () => {
    expect(
      inferWinnerFromSets([
        { p1_games: 7, p2_games: 7, tiebreak_p1: 8, tiebreak_p2: 6 },
      ]),
    ).toBe("p1");
  });

  it("ignores tiebreak data when one side already has more games", () => {
    expect(
      inferWinnerFromSets([
        { p1_games: 6, p2_games: 4, tiebreak_p1: 0, tiebreak_p2: 99 },
      ]),
    ).toBe("p1");
  });

  it("returns null when sets are perfectly tied with no decisive TB", () => {
    expect(
      inferWinnerFromSets([
        { p1_games: 6, p2_games: 4 },
        { p1_games: 4, p2_games: 6 },
      ]),
    ).toBeNull();
  });

  it("returns null when an equal-games set has no tiebreak data", () => {
    expect(
      inferWinnerFromSets([{ p1_games: 6, p2_games: 6 }]),
    ).toBeNull();
  });
});

describe("hasAnyGames", () => {
  it("returns false for empty rows", () => {
    expect(hasAnyGames([{ p1_games: 0, p2_games: 0 }])).toBe(false);
  });
  it("returns true when at least one set has games", () => {
    expect(
      hasAnyGames([
        { p1_games: 0, p2_games: 0 },
        { p1_games: 6, p2_games: 4 },
      ]),
    ).toBe(true);
  });
});
