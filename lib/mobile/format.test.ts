import { describe, expect, it } from "vitest";
import {
  computeRecord,
  formatRelativeShort,
  formatSetsScore,
  initialsOf,
  mergeFeed,
} from "./format";

const NOW = new Date("2026-07-12T12:00:00Z");

describe("formatRelativeShort", () => {
  it("renders minutes/hours/days in russian", () => {
    expect(formatRelativeShort("2026-07-12T11:55:00Z", "ru", NOW)).toBe("5м");
    expect(formatRelativeShort("2026-07-12T09:00:00Z", "ru", NOW)).toBe("3ч");
    expect(formatRelativeShort("2026-07-10T12:00:00Z", "ru", NOW)).toBe("2д");
  });

  it("renders english units", () => {
    expect(formatRelativeShort("2026-07-12T11:55:00Z", "en", NOW)).toBe("5m");
    expect(formatRelativeShort("2026-07-12T09:00:00Z", "en", NOW)).toBe("3h");
  });

  it("falls back to a short date after 7 days", () => {
    const out = formatRelativeShort("2026-06-01T12:00:00Z", "ru", NOW);
    expect(out).toMatch(/июн/i);
  });

  it("handles just-now and invalid dates", () => {
    expect(formatRelativeShort("2026-07-12T11:59:40Z", "ru", NOW)).toBe("сейчас");
    expect(formatRelativeShort("garbage", "ru", NOW)).toBe("");
  });
});

describe("formatSetsScore", () => {
  it("formats tournament-shaped sets from p1 perspective", () => {
    expect(
      formatSetsScore(
        [
          { p1: 6, p2: 4 },
          { p1: 7, p2: 6 },
        ],
        true,
      ),
    ).toBe("6:4 7:6");
  });

  it("flips friendly-shaped sets for the p2 side", () => {
    expect(
      formatSetsScore(
        [
          { p1_games: 6, p2_games: 4 },
          { p1_games: 2, p2_games: 6 },
        ],
        false,
      ),
    ).toBe("4:6 6:2");
  });

  it("returns empty string when no sets", () => {
    expect(formatSetsScore(null, true)).toBe("");
    expect(formatSetsScore([], false)).toBe("");
  });
});

describe("mergeFeed", () => {
  it("merges, sorts newest first and caps", () => {
    const merged = mergeFeed(
      [
        [
          { at: "2026-07-12T10:00:00Z", payload: "a" },
          { at: "2026-07-12T08:00:00Z", payload: "b" },
        ],
        [{ at: "2026-07-12T09:00:00Z", payload: "c" }],
      ],
      2,
    );
    expect(merged.map((m) => m.payload)).toEqual(["a", "c"]);
  });

  it("sinks invalid dates to the bottom", () => {
    const merged = mergeFeed(
      [
        [
          { at: "oops", payload: "bad" },
          { at: "2026-07-12T09:00:00Z", payload: "good" },
        ],
      ],
      10,
    );
    expect(merged[0]?.payload).toBe("good");
  });
});

describe("computeRecord", () => {
  it("counts wins, losses and winrate ignoring undecided", () => {
    expect(computeRecord([true, true, false, null])).toEqual({
      played: 4,
      wins: 2,
      losses: 1,
      winrate: 67,
    });
  });

  it("returns null winrate with no decided matches", () => {
    expect(computeRecord([null])).toEqual({
      played: 1,
      wins: 0,
      losses: 0,
      winrate: null,
    });
  });
});

describe("initialsOf", () => {
  it("takes first letters of two words", () => {
    expect(initialsOf("Иван Петров")).toBe("ИП");
    expect(initialsOf("Serena")).toBe("S");
    expect(initialsOf(null)).toBe("?");
  });
});
