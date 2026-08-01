import { describe, it, expect } from "vitest";
import { validateScoreLoose, countSetWins, type ScoreSetInput } from "./score-validation";

const s = (p1: number, p2: number, tb?: [number, number]): ScoreSetInput => ({
  p1,
  p2,
  tb_p1: tb ? tb[0] : null,
  tb_p2: tb ? tb[1] : null,
});

describe("validateScoreLoose — accepts any determinable score", () => {
  it("accepts a classic straight-sets win", () => {
    expect(validateScoreLoose([s(6, 4), s(6, 0)])).toEqual({ ok: true });
  });

  it("accepts a single set even in a nominally best-of-3 match", () => {
    expect(validateScoreLoose([s(6, 4)])).toEqual({ ok: true });
  });

  it("accepts non-standard game counts (tiebreak to 10, short sets, marathons)", () => {
    expect(validateScoreLoose([s(10, 8)])).toEqual({ ok: true });
    expect(validateScoreLoose([s(4, 2), s(5, 4)])).toEqual({ ok: true });
    expect(validateScoreLoose([s(6, 5)])).toEqual({ ok: true });
    expect(validateScoreLoose([s(8, 6), s(12, 10)])).toEqual({ ok: true });
    expect(validateScoreLoose([s(1, 0, [10, 7])])).toEqual({ ok: true });
  });

  it("accepts an 'extra' set after the match was mathematically decided", () => {
    expect(validateScoreLoose([s(6, 4), s(6, 4), s(6, 4)])).toEqual({ ok: true });
  });

  it("accepts a tied set as long as the overall winner is determinable", () => {
    expect(validateScoreLoose([s(6, 6), s(6, 4)])).toEqual({ ok: true });
  });

  it("rejects an empty score", () => {
    expect(validateScoreLoose([])).toEqual({ ok: false, error: "score_too_few_sets" });
  });

  it("rejects a score with no determinable winner", () => {
    expect(validateScoreLoose([s(6, 4), s(4, 6)])).toEqual({
      ok: false,
      error: "tied_score",
    });
    expect(validateScoreLoose([s(6, 6)])).toEqual({ ok: false, error: "tied_score" });
    expect(validateScoreLoose([s(0, 0)])).toEqual({ ok: false, error: "tied_score" });
  });
});

describe("countSetWins", () => {
  it("counts only strictly-won sets", () => {
    expect(countSetWins([s(6, 4), s(6, 6), s(2, 6)])).toEqual({ p1: 1, p2: 1 });
  });

  it("handles both orientations", () => {
    expect(countSetWins([s(0, 6), s(1, 6)])).toEqual({ p1: 0, p2: 2 });
  });
});
