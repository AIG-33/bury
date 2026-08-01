import { describe, it, expect } from "vitest";
import { CloseGroupsSchema, MatchRulesSchema } from "./schema";

describe("MatchRulesSchema — set_target limits", () => {
  it.each(["best_of_3", "best_of_5", "single_set"] as const)(
    "%s accepts a tiebreak-set target of 10",
    (kind) => {
      const parsed = MatchRulesSchema.safeParse({
        kind,
        set_target: 10,
        no_ad: false,
        super_tiebreak_decider: false,
        set_tiebreak_at: 10,
      });
      expect(parsed.success).toBe(true);
    },
  );

  it("rejects a set target above 10", () => {
    const parsed = MatchRulesSchema.safeParse({
      kind: "best_of_3",
      set_target: 11,
      no_ad: false,
      super_tiebreak_decider: false,
      set_tiebreak_at: 10,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a set target below 4", () => {
    const parsed = MatchRulesSchema.safeParse({
      kind: "best_of_3",
      set_target: 3,
      no_ad: false,
      super_tiebreak_decider: false,
      set_tiebreak_at: 6,
    });
    expect(parsed.success).toBe(false);
  });

  it("still parses the legacy default rules (6 / tiebreak at 6)", () => {
    const parsed = MatchRulesSchema.safeParse({
      kind: "best_of_3",
      set_target: 6,
      no_ad: false,
      super_tiebreak_decider: false,
      set_tiebreak_at: 6,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("CloseGroupsSchema — extra (best runner-up) qualifiers", () => {
  const base = {
    tournament_id: "5a6f0f0e-0000-4000-8000-000000000000",
    advance_per_group: 1,
    playoff_size: 4,
  };

  it("defaults extra_qualifiers to 0 when omitted (legacy callers)", () => {
    const parsed = CloseGroupsSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.extra_qualifiers).toBe(0);
  });

  it("accepts the Women's scheme: top-1 + 1 best second → semifinals", () => {
    const parsed = CloseGroupsSchema.safeParse({ ...base, extra_qualifiers: 1 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.extra_qualifiers).toBe(1);
  });

  it("rejects a negative extra_qualifiers", () => {
    const parsed = CloseGroupsSchema.safeParse({ ...base, extra_qualifiers: -1 });
    expect(parsed.success).toBe(false);
  });
});
