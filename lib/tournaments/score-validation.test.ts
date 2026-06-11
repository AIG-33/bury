import { describe, it, expect } from "vitest";
import { validateScoreAgainstRules, type ScoreSetInput } from "./score-validation";
import type { MatchRules } from "./schema";

const BO3: MatchRules = {
  kind: "best_of_3",
  set_target: 6,
  no_ad: false,
  super_tiebreak_decider: false,
  set_tiebreak_at: 6,
};

const BO3_SUPER: MatchRules = { ...BO3, super_tiebreak_decider: true } as MatchRules;

const BO5: MatchRules = {
  kind: "best_of_5",
  set_target: 6,
  no_ad: false,
  set_tiebreak_at: 6,
};

const SINGLE: MatchRules = {
  kind: "single_set",
  set_target: 6,
  no_ad: false,
  set_tiebreak_at: 6,
};

const PRO8: MatchRules = { kind: "pro_set", target_games: 8, no_ad: false };
const FTG4: MatchRules = { kind: "first_to_games", target_games: 4, no_ad: false };
const TIMED: MatchRules = { kind: "timed", minutes: 45, no_ad: false };

const s = (p1: number, p2: number, tb?: [number, number]): ScoreSetInput => ({
  p1,
  p2,
  tb_p1: tb ? tb[0] : null,
  tb_p2: tb ? tb[1] : null,
});

describe("validateScoreAgainstRules — best_of_3", () => {
  it("accepts a straight-sets win", () => {
    expect(validateScoreAgainstRules([s(6, 4), s(6, 0)], BO3)).toEqual({ ok: true });
  });

  it("accepts a three-set win with 7-5 and 7-6 sets", () => {
    expect(validateScoreAgainstRules([s(7, 5), s(6, 7), s(7, 6)], BO3)).toEqual({
      ok: true,
    });
  });

  it("rejects no sets at all", () => {
    expect(validateScoreAgainstRules([], BO3)).toEqual({
      ok: false,
      error: "score_too_few_sets",
    });
  });

  it("rejects a single set (match not decided)", () => {
    expect(validateScoreAgainstRules([s(6, 4)], BO3)).toEqual({
      ok: false,
      error: "score_too_few_sets",
    });
  });

  it("rejects 1-1 in sets without a decider", () => {
    expect(validateScoreAgainstRules([s(6, 4), s(4, 6)], BO3)).toEqual({
      ok: false,
      error: "score_too_few_sets",
    });
  });

  it("rejects more than 3 sets", () => {
    expect(
      validateScoreAgainstRules([s(6, 4), s(4, 6), s(6, 4), s(6, 4)], BO3),
    ).toEqual({ ok: false, error: "score_too_many_sets" });
  });

  it("rejects a third set after the match was already decided 2-0", () => {
    expect(validateScoreAgainstRules([s(6, 4), s(6, 4), s(6, 4)], BO3)).toEqual({
      ok: false,
      error: "score_extra_sets",
    });
  });

  it("rejects a tied set", () => {
    expect(validateScoreAgainstRules([s(6, 6), s(6, 4)], BO3)).toEqual({
      ok: false,
      error: "score_set_tie",
    });
  });

  it.each([
    [6, 5],
    [8, 6],
    [5, 3],
    [7, 4],
  ])("rejects implausible set score %i-%i", (a, b) => {
    expect(validateScoreAgainstRules([s(a, b), s(6, 0)], BO3)).toEqual({
      ok: false,
      error: "score_invalid_set",
    });
  });

  it("accepts 6-x for x ≤ 4, 7-5 and 7-6 (both orientations)", () => {
    for (const set of [s(6, 0), s(6, 4), s(7, 5), s(7, 6), s(0, 6), s(5, 7), s(6, 7)]) {
      expect(validateScoreAgainstRules([set, set], BO3)).toEqual({ ok: true });
    }
  });
});

describe("validateScoreAgainstRules — best_of_3 with super-tiebreak decider", () => {
  it("accepts a 10-8 super tiebreak as the third set", () => {
    expect(
      validateScoreAgainstRules([s(6, 4), s(4, 6), s(10, 8)], BO3_SUPER),
    ).toEqual({ ok: true });
  });

  it("accepts a 1-0 set carrying the tiebreak points", () => {
    expect(
      validateScoreAgainstRules([s(6, 4), s(4, 6), s(1, 0, [10, 7])], BO3_SUPER),
    ).toEqual({ ok: true });
  });

  it("still accepts a regular deciding set (UI digit picker caps at 7)", () => {
    expect(
      validateScoreAgainstRules([s(6, 4), s(4, 6), s(6, 3)], BO3_SUPER),
    ).toEqual({ ok: true });
  });

  it("rejects a super tiebreak without a 2-point margin", () => {
    expect(
      validateScoreAgainstRules([s(6, 4), s(4, 6), s(10, 9)], BO3_SUPER),
    ).toEqual({ ok: false, error: "score_invalid_super_tiebreak" });
  });

  it("rejects a 1-0 set whose tiebreak winner contradicts the set winner", () => {
    expect(
      validateScoreAgainstRules([s(6, 4), s(4, 6), s(1, 0, [7, 10])], BO3_SUPER),
    ).toEqual({ ok: false, error: "score_invalid_super_tiebreak" });
  });

  it("does not allow 10-8 as a NON-deciding set", () => {
    expect(validateScoreAgainstRules([s(10, 8), s(6, 4)], BO3_SUPER)).toEqual({
      ok: false,
      error: "score_invalid_set",
    });
  });
});

describe("validateScoreAgainstRules — best_of_5", () => {
  it("accepts a 3-1 win", () => {
    expect(
      validateScoreAgainstRules([s(6, 4), s(4, 6), s(6, 2), s(7, 6)], BO5),
    ).toEqual({ ok: true });
  });

  it("rejects two sets only", () => {
    expect(validateScoreAgainstRules([s(6, 4), s(6, 4)], BO5)).toEqual({
      ok: false,
      error: "score_too_few_sets",
    });
  });

  it("rejects a fourth set after a 3-0 sweep", () => {
    expect(
      validateScoreAgainstRules([s(6, 4), s(6, 4), s(6, 4), s(6, 4)], BO5),
    ).toEqual({ ok: false, error: "score_extra_sets" });
  });
});

describe("validateScoreAgainstRules — single_set", () => {
  it("accepts one valid set", () => {
    expect(validateScoreAgainstRules([s(7, 6)], SINGLE)).toEqual({ ok: true });
  });

  it("rejects two sets", () => {
    expect(validateScoreAgainstRules([s(6, 4), s(6, 4)], SINGLE)).toEqual({
      ok: false,
      error: "score_too_many_sets",
    });
  });

  it("rejects an implausible score", () => {
    expect(validateScoreAgainstRules([s(6, 5)], SINGLE)).toEqual({
      ok: false,
      error: "score_invalid_set",
    });
  });
});

describe("validateScoreAgainstRules — pro_set (to 8)", () => {
  it.each([
    [8, 4, true],
    [9, 7, true],
    [9, 8, true],
    [8, 7, false],
    [10, 8, false],
    [7, 5, false],
  ])("%i-%i → %s", (a, b, valid) => {
    const result = validateScoreAgainstRules([s(a, b)], PRO8);
    expect(result.ok).toBe(valid);
  });
});

describe("validateScoreAgainstRules — first_to_games (to 4)", () => {
  it("accepts 4-2", () => {
    expect(validateScoreAgainstRules([s(4, 2)], FTG4)).toEqual({ ok: true });
  });

  it("accepts 4-3 (no margin required)", () => {
    expect(validateScoreAgainstRules([s(4, 3)], FTG4)).toEqual({ ok: true });
  });

  it("rejects 5-3 (past the target)", () => {
    expect(validateScoreAgainstRules([s(5, 3)], FTG4)).toEqual({
      ok: false,
      error: "score_invalid_set",
    });
  });

  it("rejects 3-2 (target not reached)", () => {
    expect(validateScoreAgainstRules([s(3, 2)], FTG4)).toEqual({
      ok: false,
      error: "score_invalid_set",
    });
  });
});

describe("validateScoreAgainstRules — timed", () => {
  it("accepts free-form game counts", () => {
    expect(validateScoreAgainstRules([s(9, 7)], TIMED)).toEqual({ ok: true });
  });

  it("still rejects an empty score", () => {
    expect(validateScoreAgainstRules([], TIMED)).toEqual({
      ok: false,
      error: "score_too_few_sets",
    });
  });
});

describe("validateScoreAgainstRules — custom set targets", () => {
  it("supports short sets to 4 (tiebreak at 4-all → 5-4)", () => {
    const rules: MatchRules = {
      kind: "best_of_3",
      set_target: 4,
      no_ad: true,
      super_tiebreak_decider: false,
      set_tiebreak_at: 4,
    };
    expect(validateScoreAgainstRules([s(4, 2), s(5, 4)], rules)).toEqual({ ok: true });
    expect(validateScoreAgainstRules([s(6, 4), s(4, 2)], rules)).toEqual({
      ok: false,
      error: "score_invalid_set",
    });
  });
});
