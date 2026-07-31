import { describe, expect, it } from "vitest";
import {
  bucketsFromManualAssignment,
  buildMatchesForNewGroupMember,
  buildRoundRobinSchedule,
  buildSingleEliminationBracket,
  computeRoundRobinStandings,
  computeWinnerSide,
  distributeIntoGroups,
  nextPowerOfTwo,
  orderForSeeding,
  orderQualifiersForPlayoff,
  seedPositions,
  shuffleDeterministic,
  type GroupQualifier,
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

describe("buildMatchesForNewGroupMember", () => {
  it("creates exactly one match against every current member", () => {
    const rows = buildMatchesForNewGroupMember({
      newPlayerId: "pX",
      memberIds: ["p1", "p2", "p3"],
      startRound: 4,
    });
    expect(rows).toHaveLength(3);
    const opponents = rows.map((m) => (m.p1_id === "pX" ? m.p2_id : m.p1_id));
    expect(new Set(opponents)).toEqual(new Set(["p1", "p2", "p3"]));
    for (const m of rows) {
      expect([m.p1_id, m.p2_id]).toContain("pX");
    }
  });

  it("appends sequential rounds starting at startRound (one match per round)", () => {
    const rows = buildMatchesForNewGroupMember({
      newPlayerId: "pX",
      memberIds: ["p1", "p2"],
      startRound: 6,
    });
    expect(rows.map((m) => m.round)).toEqual([6, 7]);
    expect(rows.every((m) => m.bracket_slot === 1)).toBe(true);
  });

  it("keeps the lower-id-first ordering convention", () => {
    const rows = buildMatchesForNewGroupMember({
      newPlayerId: "b",
      memberIds: ["a", "c"],
      startRound: 1,
    });
    expect(rows[0]).toMatchObject({ p1_id: "a", p2_id: "b" });
    expect(rows[1]).toMatchObject({ p1_id: "b", p2_id: "c" });
  });

  it("ignores the new player if present in memberIds and handles empty groups", () => {
    expect(
      buildMatchesForNewGroupMember({ newPlayerId: "pX", memberIds: ["pX"], startRound: 1 }),
    ).toEqual([]);
    expect(
      buildMatchesForNewGroupMember({ newPlayerId: "pX", memberIds: [], startRound: 1 }),
    ).toEqual([]);
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

describe("distributeIntoGroups", () => {
  it("snake-seeds by rating evenly across N groups", () => {
    // p1 strongest (Elo 1800), p8 weakest (Elo 1100). With 2 groups:
    // serpentine order  A B B A A B B A
    // so seeds 1,4,5,8 → A; seeds 2,3,6,7 → B
    const buckets = distributeIntoGroups({
      players: players(8),
      groupsCount: 2,
      method: "rating",
    });
    const a = buckets[0].players.map((p) => p.id);
    const b = buckets[1].players.map((p) => p.id);
    expect(a).toEqual(["p1", "p4", "p5", "p8"]);
    expect(b).toEqual(["p2", "p3", "p6", "p7"]);
  });

  it("handles odd splits by leaving the last group one short", () => {
    const buckets = distributeIntoGroups({
      players: players(11),
      groupsCount: 3,
      method: "rating",
    });
    expect(buckets.map((b) => b.players.length).sort()).toEqual([3, 4, 4]);
  });

  it("rejects fewer players than groups", () => {
    expect(() =>
      distributeIntoGroups({ players: players(3), groupsCount: 4, method: "rating" }),
    ).toThrow();
  });

  it("fills sequential blocks for method=manual", () => {
    const buckets = distributeIntoGroups({
      players: players(6),
      groupsCount: 2,
      method: "manual",
    });
    // Manual = predictable blocks in caller order: first half → A, rest → B.
    expect(buckets[0].players.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(buckets[1].players.map((p) => p.id)).toEqual(["p4", "p5", "p6"]);
  });

  it("balances uneven manual splits with earlier groups one larger", () => {
    const buckets = distributeIntoGroups({
      players: players(11),
      groupsCount: 3,
      method: "manual",
    });
    expect(buckets.map((b) => b.players.length)).toEqual([4, 4, 3]);
    expect(buckets[0].players.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(buckets[1].players.map((p) => p.id)).toEqual(["p5", "p6", "p7", "p8"]);
    expect(buckets[2].players.map((p) => p.id)).toEqual(["p9", "p10", "p11"]);
  });

  it("keeps every manual group at ≥2 when players ≥ 2×groups", () => {
    const buckets = distributeIntoGroups({
      players: players(7),
      groupsCount: 3,
      method: "manual",
    });
    expect(buckets.every((b) => b.players.length >= 2)).toBe(true);
  });
});

describe("bucketsFromManualAssignment", () => {
  const assign = (entries: Array<[string, number]>) => new Map(entries);

  it("places every player into the chosen group, preserving roster order", () => {
    const res = bucketsFromManualAssignment({
      players: players(6),
      groupsCount: 2,
      assignment: assign([
        ["p1", 1],
        ["p2", 0],
        ["p3", 1],
        ["p4", 0],
        ["p5", 0],
        ["p6", 1],
      ]),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.buckets[0].players.map((p) => p.id)).toEqual(["p2", "p4", "p5"]);
    expect(res.buckets[1].players.map((p) => p.id)).toEqual(["p1", "p3", "p6"]);
    expect(res.buckets.map((b) => b.position)).toEqual([0, 1]);
  });

  it("rejects an incomplete assignment", () => {
    const res = bucketsFromManualAssignment({
      players: players(4),
      groupsCount: 2,
      assignment: assign([
        ["p1", 0],
        ["p2", 0],
        ["p3", 1],
      ]),
    });
    expect(res).toEqual({ ok: false, error: "assignment_incomplete" });
  });

  it("rejects ids that are not in the roster", () => {
    const res = bucketsFromManualAssignment({
      players: players(4),
      groupsCount: 2,
      assignment: assign([
        ["p1", 0],
        ["p2", 0],
        ["p3", 1],
        ["ghost", 1],
      ]),
    });
    expect(res).toEqual({ ok: false, error: "assignment_unknown_player" });
  });

  it("rejects a group index outside the requested range", () => {
    const res = bucketsFromManualAssignment({
      players: players(4),
      groupsCount: 2,
      assignment: assign([
        ["p1", 0],
        ["p2", 0],
        ["p3", 1],
        ["p4", 2],
      ]),
    });
    expect(res).toEqual({ ok: false, error: "assignment_index_out_of_range" });
  });

  it("rejects a layout that leaves a group under the minimum size", () => {
    const res = bucketsFromManualAssignment({
      players: players(4),
      groupsCount: 2,
      assignment: assign([
        ["p1", 0],
        ["p2", 0],
        ["p3", 0],
        ["p4", 1],
      ]),
    });
    expect(res).toEqual({ ok: false, error: "group_too_small" });
  });

  it("rejects an empty group even when all players are assigned elsewhere", () => {
    const res = bucketsFromManualAssignment({
      players: players(4),
      groupsCount: 3,
      assignment: assign([
        ["p1", 0],
        ["p2", 0],
        ["p3", 1],
        ["p4", 1],
      ]),
    });
    expect(res).toEqual({ ok: false, error: "group_too_small" });
  });
});

// Simulate the round-1 pairs a given seeding order produces (mirrors
// buildSingleEliminationBracket with method="manual").
function roundOnePairs(ordered: Player[], size: number): Array<[string | null, string | null]> {
  const seeded: Array<string | null> = new Array(size).fill(null);
  ordered.forEach((p, i) => {
    seeded[i] = p.id;
  });
  const pos = seedPositions(size);
  const pairs: Array<[string | null, string | null]> = [];
  for (let m = 0; m < size / 2; m++) {
    pairs.push([seeded[pos[m * 2] - 1], seeded[pos[m * 2 + 1] - 1]]);
  }
  return pairs;
}

describe("orderQualifiersForPlayoff", () => {
  const qualifier = (
    group: number,
    rank: number,
    player: Player,
    stats?: GroupQualifier["stats"],
  ): GroupQualifier => ({ group_position: group, rank, player, stats });

  it("orders by rank then group position (2 groups — classic cross)", () => {
    const ps = players(8);
    const q: GroupQualifier[] = [
      qualifier(1, 2, ps[7]), // B2
      qualifier(0, 1, ps[0]), // A1
      qualifier(1, 1, ps[1]), // B1
      qualifier(0, 2, ps[6]), // A2
    ];
    const ordered = orderQualifiersForPlayoff(q);
    expect(ordered.map((p) => p.id)).toEqual(["p1", "p2", "p7", "p8"]);
    // A1–B2 and B1–A2: no group rematch in the semifinal of a 4-bracket.
    expect(roundOnePairs(ordered, 4)).toEqual([
      ["p1", "p8"],
      ["p2", "p7"],
    ]);
  });

  it("3 groups × top-2 in a bracket of 8: no group rematch in round 1 (Women's case)", () => {
    const ps = players(6);
    const q: GroupQualifier[] = [
      qualifier(0, 1, ps[0]), // A1
      qualifier(1, 1, ps[1]), // B1
      qualifier(2, 1, ps[2]), // C1
      qualifier(0, 2, ps[3]), // A2
      qualifier(1, 2, ps[4]), // B2
      qualifier(2, 2, ps[5]), // C2
    ];
    const ordered = orderQualifiersForPlayoff(q, 8);
    const pairs = roundOnePairs(ordered, 8);
    const groupOf = new Map([
      ["p1", 0],
      ["p2", 1],
      ["p3", 2],
      ["p4", 0],
      ["p5", 1],
      ["p6", 2],
    ]);
    for (const [a, b] of pairs) {
      if (a && b) expect(groupOf.get(a)).not.toBe(groupOf.get(b));
    }
    // Byes must land on group winners (rank-1 tier holds seeds 1 and 2).
    const byes = pairs.filter(([a, b]) => (a == null) !== (b == null));
    expect(byes).toHaveLength(2);
    for (const [a, b] of byes) {
      expect(["p1", "p2", "p3"]).toContain(a ?? b);
    }
  });

  it("4 groups × top-2 in a bracket of 8: group opponents can only re-meet in the final (Men's case)", () => {
    const ps = players(8);
    const q: GroupQualifier[] = Array.from({ length: 4 }, (_, g) => [
      qualifier(g, 1, ps[g]),
      qualifier(g, 2, ps[4 + g]),
    ]).flat();
    const ordered = orderQualifiersForPlayoff(q, 8);
    // Same-group players must sit in opposite halves of the line-up.
    const slotOf = new Map<string, number>();
    const pos = seedPositions(8);
    ordered.forEach((p, i) => slotOf.set(p.id, pos.indexOf(i + 1)));
    for (let g = 0; g < 4; g++) {
      const first = slotOf.get(ps[g].id)!;
      const second = slotOf.get(ps[4 + g].id)!;
      expect(Math.floor(first / 4)).not.toBe(Math.floor(second / 4));
    }
  });

  it("gives byes to the best group winners when stats are provided", () => {
    const ps = players(6);
    const q: GroupQualifier[] = [
      qualifier(0, 1, ps[0], { wins: 2, set_diff: 3, game_diff: 10 }),
      qualifier(1, 1, ps[1], { wins: 3, set_diff: 5, game_diff: 14 }), // best record
      qualifier(2, 1, ps[2], { wins: 3, set_diff: 6, game_diff: 20 }), // even better
      qualifier(0, 2, ps[3], { wins: 1, set_diff: 0, game_diff: 0 }),
      qualifier(1, 2, ps[4], { wins: 1, set_diff: -1, game_diff: -2 }),
      qualifier(2, 2, ps[5], { wins: 1, set_diff: -2, game_diff: -4 }),
    ];
    const ordered = orderQualifiersForPlayoff(q, 8);
    // Seeds 1 and 2 (the two byes in a 6-of-8 draw) go to C1 and B1.
    expect(ordered[0].id).toBe("p3");
    expect(ordered[1].id).toBe("p2");
    const pairs = roundOnePairs(ordered, 8);
    const byes = pairs
      .filter(([a, b]) => (a == null) !== (b == null))
      .map(([a, b]) => a ?? b);
    expect(byes.sort()).toEqual(["p2", "p3"]);
  });
});

describe("buildSingleEliminationBracket with explicit bracketSize", () => {
  it("honors a larger requested bracket (byes fill the extra slots)", () => {
    const { bracketSize, totalRounds, matches } = buildSingleEliminationBracket({
      players: players(6),
      method: "manual",
      bracketSize: 16,
    });
    expect(bracketSize).toBe(16);
    expect(totalRounds).toBe(4);
    expect(matches.filter((m) => m.round === 1)).toHaveLength(8);
  });

  it("ignores a bracketSize smaller than the field or not a power of two", () => {
    expect(
      buildSingleEliminationBracket({ players: players(6), method: "manual", bracketSize: 4 })
        .bracketSize,
    ).toBe(8);
    expect(
      buildSingleEliminationBracket({ players: players(6), method: "manual", bracketSize: 12 })
        .bracketSize,
    ).toBe(8);
  });
});
