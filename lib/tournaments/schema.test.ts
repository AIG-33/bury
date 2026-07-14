import { describe, it, expect } from "vitest";
import { MatchRulesSchema } from "./schema";

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
