import { describe, expect, it } from "vitest";
import { playoffStageKey, playoffStageTitle, type PlayoffStageLabels } from "./round-names";

const ru: PlayoffStageLabels = {
  stage_final: "Финал",
  stage_semifinal: "Полуфинал",
  stage_quarterfinal: "1/4 финала",
  stage_round_of_16: "1/8 финала",
  stage_round_of_32: "1/16 финала",
  stage_round: (n) => `Раунд ${n}`,
};

describe("playoffStageKey", () => {
  it("names stages counting from the last round", () => {
    // 16-player bracket: rounds 1..4.
    expect(playoffStageKey(4, 4)).toBe("final");
    expect(playoffStageKey(3, 4)).toBe("semifinal");
    expect(playoffStageKey(2, 4)).toBe("quarterfinal");
    expect(playoffStageKey(1, 4)).toBe("round_of_16");
  });

  it("handles a 2-player bracket (single final)", () => {
    expect(playoffStageKey(1, 1)).toBe("final");
  });

  it("names round of 32 in a 32-player bracket", () => {
    expect(playoffStageKey(1, 5)).toBe("round_of_32");
  });

  it("returns null for rounds deeper than round of 32", () => {
    // 64-player bracket: round 1 has no named stage.
    expect(playoffStageKey(1, 6)).toBeNull();
    expect(playoffStageKey(2, 6)).toBe("round_of_32");
  });
});

describe("playoffStageTitle", () => {
  it("resolves localized labels for named stages", () => {
    expect(playoffStageTitle(4, 4, ru)).toBe("Финал");
    expect(playoffStageTitle(3, 4, ru)).toBe("Полуфинал");
    expect(playoffStageTitle(2, 4, ru)).toBe("1/4 финала");
    expect(playoffStageTitle(1, 4, ru)).toBe("1/8 финала");
    expect(playoffStageTitle(1, 5, ru)).toBe("1/16 финала");
  });

  it("falls back to the generic round label for very deep rounds", () => {
    expect(playoffStageTitle(1, 6, ru)).toBe("Раунд 1");
  });
});
