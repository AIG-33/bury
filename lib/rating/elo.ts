// =============================================================================
// Pure Elo math.
//
// Why pure / framework-free:
//   – Deterministic, trivially unit-testable.
//   – Reused by:
//       * server-side recalc on completed matches (lib/rating/recalc.ts)
//       * client-side preview ("if you win this you'll gain ~12 Elo")
//
// Tunables live in `DEFAULT_RATING_CONFIG` and can later be overridden by
// rows in the `rating_algorithm_config` table without touching the engine.
// =============================================================================

export type MatchKind = "tournament" | "tournament_final" | "friendly" | "league";

export type RatingConfig = {
  /** Elo curve denominator. 400 is the canonical value. */
  divisor: number;
  /** Floor – ratings never drop below this number. */
  floor: number;
  /** Number of rated matches under which a player is "provisional". */
  provisional_threshold: number;
  /** K-factor for fully provisional players (rated_matches < provisional_threshold). */
  k_provisional: number;
  /** K-factor for established players with < 30 rated matches. */
  k_intermediate: number;
  /** K-factor for veterans with 30+ matches. */
  k_established: number;
  /** Above this Elo, K-factor is reduced to keep the top stable. */
  elite_elo_threshold: number;
  /** K-factor used for elite players (overrides intermediate/established). */
  k_elite: number;
  /** Per-match-kind multiplier on the delta. */
  multipliers: Record<MatchKind, number>;
};

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  divisor: 400,
  floor: 100,
  provisional_threshold: 5,
  k_provisional: 40,
  k_intermediate: 32,
  k_established: 20,
  elite_elo_threshold: 2200,
  k_elite: 16,
  multipliers: {
    friendly: 0.5,
    tournament: 1.0,
    tournament_final: 1.25,
    league: 1.0,
  },
};

/**
 * Classic Elo expected score for player A against player B.
 * Returns a number in (0, 1).
 */
export function expectedScore(
  eloA: number,
  eloB: number,
  cfg: RatingConfig = DEFAULT_RATING_CONFIG,
): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / cfg.divisor));
}

/**
 * Pick the K-factor for a player based on:
 *   – how many rated matches they have (provisional → fast learner),
 *   – their current Elo (elite → smaller K to reduce volatility).
 */
export function kFactorFor(
  ratedMatchesCount: number,
  currentElo: number,
  cfg: RatingConfig = DEFAULT_RATING_CONFIG,
): number {
  if (ratedMatchesCount < cfg.provisional_threshold) return cfg.k_provisional;
  if (currentElo >= cfg.elite_elo_threshold) return cfg.k_elite;
  if (ratedMatchesCount < 30) return cfg.k_intermediate;
  return cfg.k_established;
}

export function multiplierFor(
  kind: MatchKind,
  cfg: RatingConfig = DEFAULT_RATING_CONFIG,
): number {
  return cfg.multipliers[kind] ?? 1;
}

export type EloUpdate = {
  /** Δ for player 1 (signed). */
  p1Delta: number;
  /** Δ for player 2 (signed). */
  p2Delta: number;
  /** Player-1 K-factor used (for audit). */
  k1: number;
  /** Player-2 K-factor used. */
  k2: number;
  /** Multiplier applied. */
  multiplier: number;
  /** Player-1 expected score (0..1). */
  p1Expected: number;
  /** New Elo for player 1, after applying floor. */
  p1NewElo: number;
  /** New Elo for player 2, after applying floor. */
  p2NewElo: number;
};

/**
 * Compute Elo deltas for a single match.
 *
 * Notes:
 *   – Each player gets their own K-factor (so a beginner beating a veteran
 *     gains a lot, while the veteran loses only a few points).
 *   – The classic Elo identity (delta_winner = -delta_loser) NO LONGER holds
 *     once K-factors differ; that's a deliberate amateur-tennis choice and
 *     is what e.g. UTR/USTA do too.
 *   – Multiplier scales both deltas symmetrically.
 *   – `winnerSide`: "p1" or "p2".
 */
export function computeMatchEloDelta(args: {
  p1Elo: number;
  p2Elo: number;
  p1Matches: number;
  p2Matches: number;
  winnerSide: "p1" | "p2";
  kind: MatchKind;
  cfg?: RatingConfig;
}): EloUpdate {
  const cfg = args.cfg ?? DEFAULT_RATING_CONFIG;
  const k1 = kFactorFor(args.p1Matches, args.p1Elo, cfg);
  const k2 = kFactorFor(args.p2Matches, args.p2Elo, cfg);
  const m = multiplierFor(args.kind, cfg);

  const e1 = expectedScore(args.p1Elo, args.p2Elo, cfg);
  const e2 = 1 - e1;
  const s1 = args.winnerSide === "p1" ? 1 : 0;
  const s2 = 1 - s1;

  const raw1 = k1 * (s1 - e1) * m;
  const raw2 = k2 * (s2 - e2) * m;

  const d1 = Math.round(raw1);
  const d2 = Math.round(raw2);

  const p1NewElo = Math.max(cfg.floor, args.p1Elo + d1);
  const p2NewElo = Math.max(cfg.floor, args.p2Elo + d2);

  return {
    p1Delta: p1NewElo - args.p1Elo,
    p2Delta: p2NewElo - args.p2Elo,
    k1,
    k2,
    multiplier: m,
    p1Expected: e1,
    p1NewElo,
    p2NewElo,
  };
}

// =============================================================================
// Doubles
// =============================================================================

export type DoublesPlayerInput = {
  elo: number;
  /** Rated DOUBLES matches count (the doubles ladder has its own K schedule). */
  matches: number;
};

export type DoublesPlayerUpdate = {
  delta: number;
  k: number;
  newElo: number;
};

export type DoublesEloUpdate = {
  /** Updates in the same order as the input: [t1a, t1b, t2a, t2b]. */
  team1: [DoublesPlayerUpdate, DoublesPlayerUpdate];
  team2: [DoublesPlayerUpdate, DoublesPlayerUpdate];
  multiplier: number;
  /** Team-1 expected score (0..1), computed from the team averages. */
  team1Expected: number;
};

/**
 * Compute Elo deltas for a doubles match (2 vs 2).
 *
 * Model:
 *   – A team's strength is the AVERAGE of its two members' doubles Elo.
 *     Average (not sum) keeps the expected-score curve on the same 400-point
 *     scale as singles.
 *   – The expected score is computed once per team; every player then gets
 *     their own K-factor applied to the same (S − E) term. A provisional
 *     player therefore moves faster than their veteran partner even though
 *     they won/lost the same match.
 *   – Multiplier and floor behave exactly like singles.
 */
export function computeDoublesMatchEloDelta(args: {
  team1: [DoublesPlayerInput, DoublesPlayerInput];
  team2: [DoublesPlayerInput, DoublesPlayerInput];
  winnerSide: "p1" | "p2";
  kind: MatchKind;
  cfg?: RatingConfig;
}): DoublesEloUpdate {
  const cfg = args.cfg ?? DEFAULT_RATING_CONFIG;
  const m = multiplierFor(args.kind, cfg);

  const t1Avg = (args.team1[0].elo + args.team1[1].elo) / 2;
  const t2Avg = (args.team2[0].elo + args.team2[1].elo) / 2;

  const e1 = expectedScore(t1Avg, t2Avg, cfg);
  const s1 = args.winnerSide === "p1" ? 1 : 0;

  const updateFor = (
    p: DoublesPlayerInput,
    s: number,
    e: number,
  ): DoublesPlayerUpdate => {
    const k = kFactorFor(p.matches, p.elo, cfg);
    const raw = Math.round(k * (s - e) * m);
    const newElo = Math.max(cfg.floor, p.elo + raw);
    return { delta: newElo - p.elo, k, newElo };
  };

  return {
    team1: [
      updateFor(args.team1[0], s1, e1),
      updateFor(args.team1[1], s1, e1),
    ],
    team2: [
      updateFor(args.team2[0], 1 - s1, 1 - e1),
      updateFor(args.team2[1], 1 - s1, 1 - e1),
    ],
    multiplier: m,
    team1Expected: e1,
  };
}

/**
 * Decide whether a player's `elo_status` should flip to "established"
 * after their N-th rated match. Idempotent — caller passes the new count.
 */
export function eloStatusFor(
  ratedMatchesCount: number,
  cfg: RatingConfig = DEFAULT_RATING_CONFIG,
): "provisional" | "established" {
  return ratedMatchesCount >= cfg.provisional_threshold
    ? "established"
    : "provisional";
}
