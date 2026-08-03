import { describe, it, expect } from "vitest";
import { computePodium, type PodiumMatch } from "./podium";

const m = (over: Partial<PodiumMatch>): PodiumMatch => ({
  round: 1,
  stage: null,
  p1_id: null,
  p2_id: null,
  winner_id: null,
  outcome: "completed",
  sets: [{ p1: 6, p2: 4 }],
  ...over,
});

describe("computePodium", () => {
  it("single elimination: final winner + loser", () => {
    const podium = computePodium(
      "single_elimination",
      [
        m({ round: 1, p1_id: "A", p2_id: "B", winner_id: "A" }),
        m({ round: 1, p1_id: "C", p2_id: "D", winner_id: "D" }),
        m({ round: 2, p1_id: "A", p2_id: "D", winner_id: "D" }),
      ],
      ["A", "B", "C", "D"],
    );
    expect(podium).toEqual({ winner_id: "D", runner_up_id: "A", third_id: null });
  });

  it("hybrid: playoff final + 3rd-place match, group matches ignored", () => {
    const podium = computePodium(
      "group_playoff",
      [
        m({ stage: "group", p1_id: "A", p2_id: "X", winner_id: "X", round: 1 }),
        m({ stage: "playoff", round: 1, p1_id: "A", p2_id: "B", winner_id: "A" }),
        m({ stage: "playoff", round: 1, p1_id: "C", p2_id: "D", winner_id: "C" }),
        m({ stage: "playoff", round: 2, p1_id: "A", p2_id: "C", winner_id: "C" }),
        m({ stage: "third_place", round: null, p1_id: "B", p2_id: "D", winner_id: "D" }),
      ],
      ["A", "B", "C", "D", "X"],
    );
    expect(podium).toEqual({ winner_id: "C", runner_up_id: "A", third_id: "D" });
  });

  it("returns null while the final is undecided", () => {
    const podium = computePodium(
      "single_elimination",
      [
        m({ round: 1, p1_id: "A", p2_id: "B", winner_id: "A" }),
        m({ round: 2, p1_id: "A", p2_id: "C", winner_id: null, outcome: "pending", sets: null }),
      ],
      ["A", "B", "C"],
    );
    expect(podium).toBeNull();
  });

  it("round robin: top-2 of the standings, no bronze", () => {
    const podium = computePodium(
      "round_robin",
      [
        m({ p1_id: "A", p2_id: "B", winner_id: "A" }),
        m({ p1_id: "A", p2_id: "C", winner_id: "A" }),
        m({ p1_id: "B", p2_id: "C", winner_id: "B" }),
      ],
      ["A", "B", "C"],
    );
    expect(podium).toEqual({ winner_id: "A", runner_up_id: "B", third_id: null });
  });

  it("round robin with zero played matches has no podium", () => {
    const podium = computePodium(
      "round_robin",
      [m({ p1_id: "A", p2_id: "B", winner_id: null, outcome: "pending", sets: null })],
      ["A", "B"],
    );
    expect(podium).toBeNull();
  });
});
