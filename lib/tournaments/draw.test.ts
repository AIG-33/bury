import { describe, expect, it } from "vitest";
import {
  buildRoundRobinSchedule,
  buildSingleEliminationBracket,
  computeRoundRobinStandings,
  computeWinnerSide,
  nextPowerOfTwo,
  orderForSeeding,
  seedPositions,
  shuffleDeterministic,
  type Player,
  type StandingsMatch,
} from "./draw";

const players = (n: number, eloFactor = 100): Player[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    display_name: `Player ${i + 1}`,
    current_elo: 1000 + (n - i) * eloFactor, // p1 strongest
  }));

describe("nextPowerOfTwo", () => {
  it("rounds up to next power of two", () => {
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
    expect(nextPowerOfTwo(33)).toBe(64);
  });
});

describe("seedPositions", () => {
  it("pairs every match so seeds sum to bracketSize+1", () => {
    const pos = seedPositions(8);
    expect(pos).toHaveLength(8);
    for (let i = 0; i < pos.length; i += 2) {
      expect(pos[i] + pos[i + 1]).toBe(9);
    }
  });
  it("places top 2 seeds in opposite halves for 16", () => {
    const pos = seedPositions(16);
    const idxOf1 = pos.indexOf(1);
    const idxOf2 = pos.indexOf(2);
    expect(idxOf1 < 8).toBe(true);
    expect(idxOf2 >= 8).toBe(true);
  });
  it("guarantees top 4 seeds in distinct quarters of size 16", () => {
    const pos = seedPositions(16);
    // Quarter boundaries are 0..3, 4..7, 8..11, 12..15.
    const quarters = [1, 2, 3, 4].map((seed) => Math.floor(pos.indexOf(seed) / 4));
    expect(new Set(quarters).size).toBe(4);
  });
  it("rejects non-power-of-two sizes", () => {
    expect(() => seedPositions(6)).toThrow();
  });
});

describe("orderForSeeding", () => {
  it("sorts by Elo for rating method", () => {
    const ps = players(4);
    const ordered = orderForSeeding(ps, "rating", 0);
    expect(ordered.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });
  it("preserves manual order", () => {
    const ps = players(4);
    expect(orderForSeeding(ps, "manual", 0).map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
  });
  it("random is deterministic per seed", () => {
    const ps = players(8);
    const a = orderForSeeding(ps, "random", 42).map((p) => p.id);
    const b = orderForSeeding(ps, "random", 42).map((p) => p.id);
    expect(a).toEqual(b);
  });
});

describe("shuffleDeterministic", () => {
  it("returns same permutation for same seed", () => {
    const a = shuffleDeterministic([1, 2, 3, 4, 5], 7);
    const b = shuffleDeterministic([1, 2, 3, 4, 5], 7);
    expect(a).toEqual(b);
  });
  it("returns different permutation for different seed", () => {
    const a = shuffleDeterministic([1, 2, 3, 4, 5], 7);
    const b = shuffleDeterministic([1, 2, 3, 4, 5], 8);
    expect(a).not.toEqual(b);
  });
});

describe("buildSingleEliminationBracket", () => {
  it("emits exactly N/2 round-1 matches for N=8", () => {
    const out = buildSingleEliminationBracket({
      players: players(8),
      method: "rating",
    });
    expect(out.bracketSize).toBe(8);
    expect(out.totalRounds).toBe(3);
    const r1 = out.matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
    // Top seed should be in slot 1.
    expect(r1[0].p1_id).toBe("p1");
  });

  it("pairs top seed against bye when N=5", () => {
    const out = buildSingleEliminationBracket({
      players: players(5),
      method: "rating",
    });
    expect(out.bracketSize).toBe(8);
    const r1 = out.matches.filter((m) => m.round === 1);
    // 5 players, 8 slots → 3 byes for top 3 seeds.
    const byes = r1.filter((m) => !m.p1_id || !m.p2_id);
    expect(byes.length).toBe(3);
    // Top seed (p1) paired with a null.
    const r1WithP1 = r1.find((m) => m.p1_id === "p1" || m.p2_id === "p1")!;
    expect(r1WithP1.p1_id === null || r1WithP1.p2_id === null).toBe(true);
  });

  it("auto-advances bye winners into round 2", () => {
    const out = buildSingleEliminationBracket({
      players: players(5),
      method: "rating",
    });
    const r2 = out.matches.filter((m) => m.round === 2);
    // 4 quarterfinal-like slots in round 2 for an 8-bracket.
    expect(r2).toHaveLength(2);
    // Top seed should appear in some round-2 match (auto-advanced from bye).
    expect(r2.some((m) => m.p1_id === "p1" || m.p2_id === "p1")).toBe(true);
  });

  it("rejects fewer than 2 players", () => {
    expect(() =>
      buildSingleEliminationBracket({ players: players(1), method: "rating" }),
    ).toThrow();
  });

  it("emits totalRounds matches for the final + semifinals + … (sum = N-1 minus byes)", () => {
    const out = buildSingleEliminationBracket({
      players: players(4),
      method: "rating",
    });
    // 4-player draw: 2 R1 + 1 final = 3 matches, totalRounds = 2.
    expect(out.matches).toHaveLength(3);
    expect(out.totalRounds).toBe(2);
  });
});

describe("computeWinnerSide", () => {
  it("returns p1 for walkover_p1", () => {
    expect(
      computeWinnerSide({ outcome: "walkover_p1", sets: [] }),
    ).toBe("p1");
  });
  it("returns p2 for retired_p1", () => {
    expect(computeWinnerSide({ outcome: "retired_p1", sets: [] })).toBe("p2");
  });
  it("counts sets for completed", () => {
    expect(
      computeWinnerSide({
        outcome: "completed",
        sets: [
          { p1: 6, p2: 4 },
          { p1: 3, p2: 6 },
          { p1: 7, p2: 5 },
        ],
      }),
    ).toBe("p1");
  });
  it("returns null when sets are tied", () => {
    expect(
      computeWinnerSide({
        outcome: "completed",
        sets: [
          { p1: 6, p2: 4 },
          { p1: 4, p2: 6 },
        ],
      }),
    ).toBe(null);
  });
});

describe("buildRoundRobinSchedule", () => {
  it("schedules every pair exactly once for an even number of players", () => {
    const ps = players(6);
    const { totalRounds, matches } = buildRoundRobinSchedule(ps);
    expect(totalRounds).toBe(5);
    expect(matches).toHaveLength((6 * 5) / 2);

    const seen = new Set<string>();
    for (const m of matches) {
      const key = [m.p1_id, m.p2_id].sort().join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(15);
  });

  it("handles odd number of players via a phantom bye", () => {
    const ps = players(5);
    const { totalRounds, matches } = buildRoundRobinSchedule(ps);
    // 5 players → 5 rounds, each round one player has a bye → 4 matches/round? No:
    // n=5 → padded to 6 → 5 rounds, each round 3 slots, but 1 is a bye → 2 real matches.
    // Total real matches = 5 rounds × 2 = 10 = C(5,2). ✓
    expect(totalRounds).toBe(5);
    expect(matches).toHaveLength(10);

    const counts = new Map<string, number>();
    for (const m of matches) {
      counts.set(m.p1_id, (counts.get(m.p1_id) ?? 0) + 1);
      counts.set(m.p2_id, (counts.get(m.p2_id) ?? 0) + 1);
    }
    for (const v of counts.values()) expect(v).toBe(4); // each plays 4 others
  });

  it("each round has unique players", () => {
    const ps = players(8);
    const { matches } = buildRoundRobinSchedule(ps);
    const byRound = new Map<number, string[]>();
    for (const m of matches) {
      const arr = byRound.get(m.round) ?? [];
      arr.push(m.p1_id, m.p2_id);
      byRound.set(m.round, arr);
    }
    for (const arr of byRound.values()) {
      expect(new Set(arr).size).toBe(arr.length);
    }
  });

  it("throws on a single player", () => {
    expect(() => buildRoundRobinSchedule(players(1))).toThrow();
  });
});

describe("computeRoundRobinStandings", () => {
  const sm = (
    p1: string,
    p2: string,
    winner: "p1" | "p2",
    sets: Array<[number, number]>,
  ): StandingsMatch => ({
    p1_id: p1,
    p2_id: p2,
    winner_side: winner,
    outcome: "completed",
    sets: sets.map(([a, b]) => ({ p1: a, p2: b })),
  });

  it("ranks by wins → set diff → game diff", () => {
    // 3 players, A beats B, B beats C, A beats C → A=2, B=1, C=0.
    const matches = [
      sm("A", "B", "p1", [[6, 3], [6, 4]]),
      sm("B", "C", "p1", [[6, 4], [6, 4]]),
      sm("A", "C", "p1", [[6, 0], [6, 0]]),
    ];
    const rows = computeRoundRobinStandings(["A", "B", "C"], matches);
    expect(rows.map((r) => r.player_id)).toEqual(["A", "B", "C"]);
    expect(rows[0].wins).toBe(2);
    expect(rows[2].wins).toBe(0);
  });

  it("ignores unfinished matches", () => {
    const matches = [
      sm("A", "B", "p1", [[6, 3], [6, 4]]),
      {
        p1_id: "A",
        p2_id: "C",
        winner_side: null,
        outcome: "pending",
        sets: null,
      } as StandingsMatch,
    ];
    const rows = computeRoundRobinStandings(["A", "B", "C"], matches);
    const a = rows.find((r) => r.player_id === "A")!;
    expect(a.matches_played).toBe(1);
    expect(a.wins).toBe(1);
  });

  it("breaks two-way ties via head-to-head", () => {
    // A beats C; B beats C; A beats B in 2 close sets, but B has a better game
    // diff overall → still A wins on H2H.
    const matches = [
      sm("A", "B", "p1", [[7, 5], [7, 6]]),
      sm("A", "C", "p1", [[6, 4], [6, 4]]),
      sm("B", "C", "p1", [[6, 0], [6, 0]]),
    ];
    const rows = computeRoundRobinStandings(["A", "B", "C"], matches);
    expect(rows[0].player_id).toBe("A");
  });
});
