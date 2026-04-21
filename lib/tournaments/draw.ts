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
