import { describe, it, expect } from "vitest";
import { planEloRevert, type EloHistoryRow, type RevertProfileState } from "./revert";
import { DEFAULT_RATING_CONFIG } from "./elo";

const profile = (over: Partial<RevertProfileState> = {}): RevertProfileState => ({
  id: "p1",
  current_elo: 1500,
  rated_matches_count: 10,
  current_elo_doubles: 1500,
  rated_matches_count_doubles: 3,
  ...over,
});

describe("planEloRevert", () => {
  it("subtracts the recorded delta from the CURRENT rating, not the historical one", () => {
    // Match gave +16 (1500→1516); later matches pushed the player to 1540.
    const history: EloHistoryRow[] = [
      { player_id: "p1", old_elo: 1500, new_elo: 1516, discipline: "singles" },
    ];
    const writes = planEloRevert(history, [profile({ current_elo: 1540 })], DEFAULT_RATING_CONFIG);
    expect(writes).not.toBeNull();
    expect(writes![0]).toMatchObject({
      id: "p1",
      discipline: "singles",
      newElo: 1524,
      newCount: 9,
    });
  });

  it("reverts a negative delta (loser gets points back)", () => {
    const history: EloHistoryRow[] = [
      { player_id: "p1", old_elo: 1500, new_elo: 1488, discipline: "singles" },
    ];
    const writes = planEloRevert(history, [profile()], DEFAULT_RATING_CONFIG);
    expect(writes![0].newElo).toBe(1512);
  });

  it("touches the doubles ladder for doubles history rows", () => {
    const history: EloHistoryRow[] = [
      { player_id: "p1", old_elo: 1500, new_elo: 1520, discipline: "doubles" },
    ];
    const writes = planEloRevert(
      history,
      [profile({ current_elo_doubles: 1520, rated_matches_count_doubles: 1 })],
      DEFAULT_RATING_CONFIG,
    );
    expect(writes![0]).toMatchObject({
      discipline: "doubles",
      newElo: 1500,
      newCount: 0,
      newStatus: "provisional",
    });
  });

  it("never lets rated_matches_count go below zero", () => {
    const history: EloHistoryRow[] = [
      { player_id: "p1", old_elo: 1500, new_elo: 1516, discipline: "singles" },
    ];
    const writes = planEloRevert(
      history,
      [profile({ rated_matches_count: 0 })],
      DEFAULT_RATING_CONFIG,
    );
    expect(writes![0].newCount).toBe(0);
  });

  it("flips elo_status back to provisional when dropping below the threshold", () => {
    const threshold = DEFAULT_RATING_CONFIG.provisional_threshold;
    const history: EloHistoryRow[] = [
      { player_id: "p1", old_elo: 1500, new_elo: 1516, discipline: "singles" },
    ];
    const writes = planEloRevert(
      history,
      [profile({ rated_matches_count: threshold })],
      DEFAULT_RATING_CONFIG,
    );
    expect(writes![0].newStatus).toBe("provisional");
  });

  it("returns null when a profile is missing (caller surfaces an error)", () => {
    const history: EloHistoryRow[] = [
      { player_id: "ghost", old_elo: 1500, new_elo: 1516, discipline: "singles" },
    ];
    expect(planEloRevert(history, [profile()], DEFAULT_RATING_CONFIG)).toBeNull();
  });

  it("plans one write per history row (4 rows for a doubles match)", () => {
    const ids = ["a", "b", "c", "d"];
    const history: EloHistoryRow[] = ids.map((id, i) => ({
      player_id: id,
      old_elo: 1500,
      new_elo: i < 2 ? 1510 : 1490,
      discipline: "doubles" as const,
    }));
    const writes = planEloRevert(
      history,
      ids.map((id) => profile({ id })),
      DEFAULT_RATING_CONFIG,
    );
    expect(writes).toHaveLength(4);
    expect(writes!.map((w) => w.newElo)).toEqual([1490, 1490, 1510, 1510]);
  });
});
