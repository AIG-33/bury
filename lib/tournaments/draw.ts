// =============================================================================
// Single-elimination bracket generator.
//
// Why we hand-roll this:
//   – Tennis amateurs draws are tiny (≤ 64 players); no need for a heavy lib.
//   – We must support arbitrary participant counts → fill with byes to the
//     next power of two, with byes assigned to the highest seeds.
//   – Three seeding flavours: rating (Elo), random (deterministic via seed),
//     manual (caller pre-orders the array).
//
// Output: a flat list of round-1 matches plus the empty match skeleton for
// later rounds. Each match has a numeric `bracket_slot` so the UI can render
// the tree without storing an explicit tree structure.
// =============================================================================

export type Player = {
  id: string;
  display_name: string | null;
  current_elo: number;
};

export type SeedingMethod = "rating" | "random" | "manual";

export type DrawMatch = {
  round: number;          // 1 = first round
  bracket_slot: number;   // 1..N within the round (left-to-right)
  p1_id: string | null;   // null = bye / TBD
  p2_id: string | null;
};

/**
 * Compute the smallest power of two ≥ n.
 * For n = 1 returns 2 (single-player draws are pointless but we still close
 * the type; the caller validates n ≥ 2).
 */
export function nextPowerOfTwo(n: number): number {
  if (n < 2) return 2;
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Standard tennis seeding pattern for a bracket of size 2..N.
 * Returns the seed-position layout for round 1, e.g. for 8 players:
 *   [1, 8, 4, 5, 3, 6, 2, 7]
 *
 * That guarantees the top 2 seeds can only meet in the final, the top 4 only
 * in the semis, and so on — same scheme used by the ATP/WTA.
 */
export function seedPositions(bracketSize: number): number[] {
  if (!Number.isInteger(Math.log2(bracketSize)) || bracketSize < 2) {
    throw new Error(`bracketSize must be a power of two ≥ 2, got ${bracketSize}`);
  }
  let positions: number[] = [1, 2];
  while (positions.length < bracketSize) {
    const next: number[] = [];
    const pairTotal = positions.length * 2 + 1;
    for (const p of positions) {
      next.push(p, pairTotal - p);
    }
    positions = next;
  }
  return positions;
}

/**
 * Mulberry32 — fast, deterministic, pure PRNG. Used for "random" seeding so
 * the caller can reproduce the exact draw with the same seed value.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle using a PRNG. */
export function shuffleDeterministic<T>(arr: T[], rngSeed: number): T[] {
  const rng = mulberry32(rngSeed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Order players according to seeding method.
 * – "rating":  highest current_elo first.
 * – "random":  Mulberry32(rngSeed) reproducible shuffle.
 * – "manual":  caller-provided order is preserved.
 */
export function orderForSeeding(
  players: Player[],
  method: SeedingMethod,
  rngSeed: number,
): Player[] {
  switch (method) {
    case "rating":
      return players.slice().sort((a, b) => b.current_elo - a.current_elo);
    case "random":
      return shuffleDeterministic(players, rngSeed);
    case "manual":
      return players.slice();
  }
}

/**
 * Build a single-elimination bracket.
 *
 * Round-1 matches are emitted with `bracket_slot` = 1..bracketSize/2.
 * If a player faces a `null` opponent (bye), they advance for free; the
 * next-round match is created with their id already in the correct side.
 *
 * Returned matches are sorted by (round, bracket_slot).
 */
export function buildSingleEliminationBracket(opts: {
  players: Player[];
  method: SeedingMethod;
  rngSeed?: number;
}): {
  bracketSize: number;
  totalRounds: number;
  matches: DrawMatch[];
} {
  const { players, method, rngSeed = 1 } = opts;
  if (players.length < 2) {
    throw new Error("Need at least 2 players to build a bracket");
  }

  const ordered = orderForSeeding(players, method, rngSeed);
  const bracketSize = nextPowerOfTwo(ordered.length);
  const totalRounds = Math.log2(bracketSize);

  // Map seed (1-based) → playerId or null (= bye placeholder).
  const seeded: Array<string | null> = new Array(bracketSize).fill(null);
  for (let i = 0; i < ordered.length; i++) {
    seeded[i] = ordered[i].id;
  }
  // Note: byes naturally fall on the lowest seeds (last elements in `seeded`).

  const positions = seedPositions(bracketSize); // length = bracketSize
  // Each seed-position pair (positions[2k], positions[2k+1]) is one R1 match.

  const matches: DrawMatch[] = [];
  // Track who's in which "next-round slot" so that bye-advancement just works.
  // Round-2 has bracketSize/4 matches; round-2 slot = ceil(round-1 slot / 2).
  for (let m = 0; m < bracketSize / 2; m++) {
    const seedA = positions[m * 2];
    const seedB = positions[m * 2 + 1];
    const playerA = seeded[seedA - 1];
    const playerB = seeded[seedB - 1];
    matches.push({
      round: 1,
      bracket_slot: m + 1,
      p1_id: playerA,
      p2_id: playerB,
    });
  }

  // Pre-create empty placeholder matches for rounds 2..totalRounds.
  // We pre-fill with "bye-advanced" players where possible.
  // After round 1, who plays in round-2 slot K is determined by:
  //   - if R1 slot 2K-1 has a bye (one side null), the non-null side advances;
  //   - same for R1 slot 2K.
  // We can compute that for any round by walking the bracket recursively.

  // Build a tree of "winners so far" for chained byes.
  const winners: Map<number, string | null> = new Map();
  for (const m of matches) {
    if (m.p1_id && !m.p2_id) winners.set(m.bracket_slot, m.p1_id);
    else if (!m.p1_id && m.p2_id) winners.set(m.bracket_slot, m.p2_id);
    else winners.set(m.bracket_slot, null); // both filled OR both null (impossible)
  }

  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / 2 ** round;
    const nextWinners = new Map<number, string | null>();
    for (let s = 1; s <= matchesInRound; s++) {
      const fromA = winners.get(s * 2 - 1) ?? null;
      const fromB = winners.get(s * 2) ?? null;
      matches.push({
        round,
        bracket_slot: s,
        p1_id: fromA,
        p2_id: fromB,
      });
      // If exactly one side is set (chained bye), advance for free again.
      if (fromA && !fromB) nextWinners.set(s, fromA);
      else if (!fromA && fromB) nextWinners.set(s, fromB);
      else nextWinners.set(s, null);
    }
    winners.clear();
    for (const [k, v] of nextWinners) winners.set(k, v);
  }

  matches.sort((a, b) => a.round - b.round || a.bracket_slot - b.bracket_slot);
  return { bracketSize, totalRounds, matches };
}

// =============================================================================
// Round-robin scheduler.
//
// Uses the classic "circle method": fix one player, rotate the rest around.
// For N players we produce R = (N-1) rounds (N even) or N rounds (N odd, one
// bye per round). Each player meets each other exactly once.
//
// We emit `round` 1..R and a `bracket_slot` that's 1..N/2 within the round.
// `bracket_slot` here is just an ordered index per round (no propagation).
// =============================================================================

export type RoundRobinMatch = {
  round: number;
  bracket_slot: number;
  p1_id: string;
  p2_id: string;
};

export function buildRoundRobinSchedule(
  players: Player[],
): { totalRounds: number; matches: RoundRobinMatch[] } {
  if (players.length < 2) {
    throw new Error("Need at least 2 players to build a round-robin schedule");
  }
  const ids = players.map((p) => p.id);
  // The circle method needs an even number — add a "BYE" sentinel for odd N.
  const BYE = "__bye__";
  if (ids.length % 2 === 1) ids.push(BYE);
  const n = ids.length;
  const rounds = n - 1;
  const matches: RoundRobinMatch[] = [];

  // The first player stays fixed; the rest rotate clockwise.
  const fixed = ids[0];
  const rotating = ids.slice(1);

  for (let r = 0; r < rounds; r++) {
    const roundList = [fixed, ...rotating];
    let slot = 1;
    for (let i = 0; i < n / 2; i++) {
      const a = roundList[i];
      const b = roundList[n - 1 - i];
      if (a !== BYE && b !== BYE) {
        // Stable order: lower id first to keep cross-round consistency in tests.
        const [p1, p2] = a < b ? [a, b] : [b, a];
        matches.push({ round: r + 1, bracket_slot: slot, p1_id: p1, p2_id: p2 });
        slot += 1;
      }
    }
    // Rotate: take last and put it second (after the fixed player).
    rotating.unshift(rotating.pop()!);
  }

  return { totalRounds: rounds, matches };
}

// =============================================================================
// Round-robin standings.
//
// Tiebreakers, in order:
//   1. Wins (matches won).
//   2. Set difference (sets won − sets lost).
//   3. Game difference (games won − games lost).
//   4. Head-to-head (only if exactly two players are tied at this point).
//   5. Player id (stable, deterministic last-resort).
// =============================================================================

export type StandingsMatch = {
  p1_id: string;
  p2_id: string;
  winner_side: "p1" | "p2" | null;
  outcome: string;
  sets: Array<{ p1: number; p2: number }> | null;
};

export type StandingRow = {
  player_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  games_won: number;
  games_lost: number;
  position: number;
};

const FINISHED = new Set([
  "completed",
  "walkover_p1",
  "walkover_p2",
  "retired_p1",
  "retired_p2",
  "dsq_p1",
  "dsq_p2",
]);

export function computeRoundRobinStandings(
  playerIds: string[],
  matches: StandingsMatch[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of playerIds) {
    rows.set(id, {
      player_id: id,
      matches_played: 0,
      wins: 0,
      losses: 0,
      sets_won: 0,
      sets_lost: 0,
      games_won: 0,
      games_lost: 0,
      position: 0,
    });
  }

  for (const m of matches) {
    if (!FINISHED.has(m.outcome)) continue;
    const a = rows.get(m.p1_id);
    const b = rows.get(m.p2_id);
    if (!a || !b) continue;
    a.matches_played += 1;
    b.matches_played += 1;

    let aSets = 0;
    let bSets = 0;
    for (const s of m.sets ?? []) {
      a.games_won += s.p1;
      a.games_lost += s.p2;
      b.games_won += s.p2;
      b.games_lost += s.p1;
      if (s.p1 > s.p2) aSets += 1;
      else if (s.p2 > s.p1) bSets += 1;
    }
    a.sets_won += aSets;
    a.sets_lost += bSets;
    b.sets_won += bSets;
    b.sets_lost += aSets;

    if (m.winner_side === "p1") {
      a.wins += 1;
      b.losses += 1;
    } else if (m.winner_side === "p2") {
      b.wins += 1;
      a.losses += 1;
    }
  }

  const sorted = [...rows.values()].sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    const sdX = x.sets_won - x.sets_lost;
    const sdY = y.sets_won - y.sets_lost;
    if (sdY !== sdX) return sdY - sdX;
    const gdX = x.games_won - x.games_lost;
    const gdY = y.games_won - y.games_lost;
    if (gdY !== gdX) return gdY - gdX;
    // Head-to-head when exactly two are tied at this level.
    const h2h = matches.find(
      (m) =>
        FINISHED.has(m.outcome) &&
        ((m.p1_id === x.player_id && m.p2_id === y.player_id) ||
          (m.p1_id === y.player_id && m.p2_id === x.player_id)),
    );
    if (h2h) {
      const xWonH2H =
        (h2h.winner_side === "p1" && h2h.p1_id === x.player_id) ||
        (h2h.winner_side === "p2" && h2h.p2_id === x.player_id);
      const yWonH2H =
        (h2h.winner_side === "p1" && h2h.p1_id === y.player_id) ||
        (h2h.winner_side === "p2" && h2h.p2_id === y.player_id);
      if (xWonH2H && !yWonH2H) return -1;
      if (yWonH2H && !xWonH2H) return 1;
    }
    return x.player_id.localeCompare(y.player_id);
  });

  sorted.forEach((row, i) => {
    row.position = i + 1;
  });

  return sorted;
}

/**
 * Compute the winning side of a finished match according to its `outcome`
 * + sets payload. Returns null if the outcome is "pending" / invalid.
 *
 * Tennis logic: more sets won wins. Ties produce null (caller must reject).
 */
export function computeWinnerSide(args: {
  outcome:
    | "completed"
    | "walkover_p1"
    | "walkover_p2"
    | "retired_p1"
    | "retired_p2"
    | "dsq_p1"
    | "dsq_p2";
  sets: Array<{ p1: number; p2: number }>;
}): "p1" | "p2" | null {
  switch (args.outcome) {
    case "walkover_p1":
    case "retired_p2":
    case "dsq_p2":
      return "p1";
    case "walkover_p2":
    case "retired_p1":
    case "dsq_p1":
      return "p2";
    case "completed": {
      let p1Wins = 0;
      let p2Wins = 0;
      for (const s of args.sets) {
        if (s.p1 > s.p2) p1Wins++;
        else if (s.p2 > s.p1) p2Wins++;
      }
      if (p1Wins === p2Wins) return null;
      return p1Wins > p2Wins ? "p1" : "p2";
    }
  }
}
