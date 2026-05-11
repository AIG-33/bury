// =============================================================================
// Liga Tennisa (https://www.ligatennisa.com/) integration helpers — pure logic.
//
// What lives here
//   * Pure helpers (tier mapping, Elo clamping, name normalisation,
//     fuzzy match scoring) — fully unit-testable, no IO.
//   * Two thin IO wrappers (`fetchLtPlayers`, `fetchLtPlayer`) that talk to
//     the upstream REST API. Both validate the response with Zod schemas
//     from `lib/validators/external-ratings.ts`.
//
// All Server Actions and React Server Components import from this file.
// They never touch the upstream API directly so the boundary stays small
// and the security/legal review surface stays auditable.
//
// Privacy / safety notes
//   * The upstream JSON exposes `password_hash` (a real bcrypt string for
//     some accounts) and `last_password_reset`. We DROP both at the
//     validator boundary (`sanitiseLtPayload`). They never reach our DB.
//   * We never store the user's email or phone — these are PII we don't
//     need and we don't want the legal exposure.
//   * The integration is opt-in per player. We never call the upstream
//     API in cron / background. Refresh is manual via the player's
//     profile page.
// =============================================================================

import {
  LtPlayerListResponse,
  LtPlayerDetail,
  type LtPlayerListItem,
  type LtPlayerDetail as LtPlayerDetailT,
} from "@/lib/validators/external-ratings";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LT_BASE_URL = "https://www.ligatennisa.com";
export const LT_API_PLAYERS = `${LT_BASE_URL}/api/players`;
export const LT_PROFILE_URL_PREFIX = `${LT_BASE_URL}/players`;
export const LT_USER_AGENT = "OpenCourtBY/1.0 (+https://opencourt.by)";

/** Soft TTL for the in-process cache of the full player list (10 minutes). */
const LIST_CACHE_TTL_MS = 10 * 60 * 1000;

/** Network timeout for upstream calls. */
const UPSTREAM_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Tier mapping
//   The LT UI labels Elo ranges with these tiers. The upstream API does NOT
//   return the tier name — only the numeric `elo_points`. We mirror their
//   tiers on our side so badges read identically to what the player sees on
//   ligatennisa.com.
//
//   Buckets are derived empirically from observed data and the colour bands
//   on the LT rating page. They're conservative on the low end so a
//   newly-imported, low-rated profile reads "Rookies" by default.
// ---------------------------------------------------------------------------

export const LT_TIERS = [
  "Rookies",
  "Satellite",
  "Futures",
  "Legger",
  "Challenger",
  "Masters",
  "Supreme",
  "Pro",
] as const;
export type LtTier = (typeof LT_TIERS)[number];

const LT_TIER_FLOORS: ReadonlyArray<readonly [LtTier, number]> = [
  ["Rookies", 0],
  ["Satellite", 1050],
  ["Futures", 1225],
  ["Legger", 1425],
  ["Challenger", 1625],
  ["Masters", 1850],
  ["Supreme", 2050],
  ["Pro", 2250],
];

/**
 * Map an Elo number to its LT tier name. Returns "Rookies" for any non-finite,
 * negative or zero input — this matches LT's own behaviour for newly-created
 * players who haven't been calibrated yet.
 */
export function ltTierForElo(elo: number | null | undefined): LtTier {
  if (elo == null || !Number.isFinite(elo)) return "Rookies";
  let current: LtTier = "Rookies";
  for (const [tier, floor] of LT_TIER_FLOORS) {
    if (elo >= floor) current = tier;
    else break;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Local Elo seeding (OpenCourt.by side)
//   Per product decision (see docs/external-ratings.md), when a new player
//   imports from LT during onboarding we seed our `profiles.current_elo`
//   from their LT singles Elo. We clamp to our 800–2200 range so the value
//   is always valid for the rating engine.
//
//   The same `clamp` is also used by Server Actions / tests; keep it as a
//   pure function so it can be tested in isolation.
// ---------------------------------------------------------------------------

export const LOCAL_ELO_MIN = 800;
export const LOCAL_ELO_MAX = 2200;
export const LOCAL_ELO_FALLBACK = 1000;

/**
 * Convert an LT Elo into a starting OpenCourt.by Elo.
 *
 * Rules:
 *   * NULL / non-finite / 0 → fallback (1000), the same default our
 *     onboarding quiz uses when no answers are provided.
 *   * Otherwise round to nearest integer and clamp to [800, 2200].
 *
 * The fallback case also covers calibrating-only LT players (whose
 * `elo_points` is essentially provisional) — they get our default and let
 * our own provisional K-factor period (first 10 matches) refine it.
 */
export function ltEloToLocalElo(ltElo: number | null | undefined): {
  elo: number;
  clamped: boolean;
  fallback: boolean;
} {
  if (ltElo == null || !Number.isFinite(ltElo) || ltElo <= 0) {
    return { elo: LOCAL_ELO_FALLBACK, clamped: false, fallback: true };
  }
  const rounded = Math.round(ltElo);
  if (rounded < LOCAL_ELO_MIN) {
    return { elo: LOCAL_ELO_MIN, clamped: true, fallback: false };
  }
  if (rounded > LOCAL_ELO_MAX) {
    return { elo: LOCAL_ELO_MAX, clamped: true, fallback: false };
  }
  return { elo: rounded, clamped: false, fallback: false };
}

// ---------------------------------------------------------------------------
// Mapping LT enums to our profile schema
// ---------------------------------------------------------------------------

/** "Правша" / "Левша" → our R/L code; null otherwise. */
export function ltForehandToHand(forehand: string | null): "R" | "L" | null {
  if (!forehand) return null;
  const v = forehand.trim().toLowerCase();
  if (v.startsWith("прав") || v === "right" || v === "r") return "R";
  if (v.startsWith("лев") || v === "left" || v === "l") return "L";
  return null;
}

/** "Двуручный" / "Одноручный" → our backhand_style code; null otherwise. */
export function ltBackhandToStyle(backhand: string | null): "one_handed" | "two_handed" | null {
  if (!backhand) return null;
  const v = backhand.trim().toLowerCase();
  if (v.startsWith("двур") || v.includes("two") || v === "2") return "two_handed";
  if (v.startsWith("однор") || v.includes("one") || v === "1") return "one_handed";
  return null;
}

/** Combine LT first/last into a display name; trims and collapses whitespace. */
export function ltDisplayName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0)
    .join(" ")
    .replace(/\s+/gu, " ");
}

/** Build a profile URL from a parsed `id`. */
export function ltProfileUrl(externalId: number | string): string {
  return `${LT_PROFILE_URL_PREFIX}/${externalId}`;
}

// ---------------------------------------------------------------------------
// Fuzzy name matching
//
// The LT search API does not actually filter by `?search=` — it returns the
// full list regardless. So we fetch once, cache for ~10 min, and rank
// candidates locally.
//
// Strategy: case-insensitive Cyrillic/Latin-friendly substring score
// against `first_name + last_name`, plus a small bonus for exact city match.
// ---------------------------------------------------------------------------

/** Normalise for matching: lower-case, strip diacritics, collapse spaces. */
export function normaliseForMatch(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, " ");
}

export type LtSearchCandidate = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  city: string | null;
  country: string | null;
  avatar: string | null;
  /** 0..1, higher = better. */
  score: number;
};

/**
 * Fuzzy-rank LT players against a search query (and optional city hint).
 *
 * Score components:
 *   * Substring of (first_name + last_name) → up to 0.7
 *     ▸ exact equality           : 1.0
 *     ▸ starts-with              : 0.85
 *     ▸ word-prefix              : 0.7
 *     ▸ contains                 : 0.5
 *     ▸ token-coverage fallback  : 0.0..0.4
 *   * City match bonus           : +0.15 (capped to 1.0)
 *   * Substring of last_name only: +0.10 (last names are most stable)
 *
 * Returns at most `limit` candidates with score > 0, sorted descending.
 */
export function rankLtCandidates(
  players: LtPlayerListItem[],
  query: string,
  options: { city?: string | null; limit?: number } = {},
): LtSearchCandidate[] {
  const q = normaliseForMatch(query);
  if (q.length === 0) return [];

  const cityNorm = normaliseForMatch(options.city);
  const limit = options.limit ?? 10;
  const queryTokens = q.split(" ").filter((t) => t.length > 0);

  const scored: LtSearchCandidate[] = [];

  for (const p of players) {
    const fullName = ltDisplayName(p.first_name, p.last_name);
    const fullNorm = normaliseForMatch(fullName);
    const lastNorm = normaliseForMatch(p.last_name);
    if (fullNorm.length === 0) continue;

    let nameScore = 0;
    if (fullNorm === q) nameScore = 1.0;
    else if (fullNorm.startsWith(q)) nameScore = 0.85;
    else if (fullNorm.split(" ").some((tok) => tok.startsWith(q))) nameScore = 0.7;
    else if (fullNorm.includes(q)) nameScore = 0.5;
    else {
      // Token-coverage: how many query tokens appear anywhere in the name?
      const hits = queryTokens.filter((t) => fullNorm.includes(t)).length;
      if (hits > 0) {
        nameScore = 0.2 + 0.2 * (hits / queryTokens.length);
      }
    }
    if (nameScore === 0) continue;

    let bonus = 0;
    if (lastNorm.length > 0 && q.includes(lastNorm)) bonus += 0.1;
    if (cityNorm.length > 0 && normaliseForMatch(p.city) === cityNorm) bonus += 0.15;

    scored.push({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      display_name: fullName,
      city: p.city,
      country: p.country,
      avatar: p.avatar,
      score: Math.min(1.0, nameScore + bonus),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ---------------------------------------------------------------------------
// IO — fetchers
//   Validated with Zod, with a small in-process cache for the heavy list.
// ---------------------------------------------------------------------------

type ListCacheEntry = { fetchedAt: number; data: LtPlayerListItem[] };
let listCache: ListCacheEntry | null = null;

/** Test-only — drops the cached list. Not exported in production callers. */
export function _resetLtCacheForTests() {
  listCache = null;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": LT_USER_AGENT },
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export class LtUpstreamError extends Error {
  readonly status: number;
  readonly cause?: unknown;
  constructor(message: string, status: number, cause?: unknown) {
    super(message);
    this.name = "LtUpstreamError";
    this.status = status;
    this.cause = cause;
  }
}

/**
 * Fetch the full LT player list. Result is cached in-process for 10 minutes.
 *
 * Use `bypassCache: true` from a manual refresh action to force a re-fetch.
 */
export async function fetchLtPlayers(
  options: { bypassCache?: boolean } = {},
): Promise<LtPlayerListItem[]> {
  if (!options.bypassCache && listCache) {
    if (Date.now() - listCache.fetchedAt < LIST_CACHE_TTL_MS) {
      return listCache.data;
    }
  }

  let resp: Response;
  try {
    resp = await fetchWithTimeout(LT_API_PLAYERS, UPSTREAM_TIMEOUT_MS);
  } catch (err) {
    throw new LtUpstreamError("liga_tennisa_unreachable", 0, err);
  }
  if (!resp.ok) {
    throw new LtUpstreamError("liga_tennisa_bad_status", resp.status);
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch (err) {
    throw new LtUpstreamError("liga_tennisa_invalid_json", resp.status, err);
  }

  const parsed = LtPlayerListResponse.safeParse(json);
  if (!parsed.success) {
    throw new LtUpstreamError("liga_tennisa_schema_mismatch", resp.status, parsed.error);
  }

  listCache = { fetchedAt: Date.now(), data: parsed.data };
  return parsed.data;
}

/**
 * Fetch a single LT player. Always bypasses cache — call sites are explicit
 * (preview-before-import, manual refresh).
 */
export async function fetchLtPlayer(externalId: number | string): Promise<LtPlayerDetailT> {
  const url = `${LT_API_PLAYERS}/${encodeURIComponent(String(externalId))}`;
  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, UPSTREAM_TIMEOUT_MS);
  } catch (err) {
    throw new LtUpstreamError("liga_tennisa_unreachable", 0, err);
  }
  if (resp.status === 404) {
    throw new LtUpstreamError("liga_tennisa_player_not_found", 404);
  }
  if (!resp.ok) {
    throw new LtUpstreamError("liga_tennisa_bad_status", resp.status);
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch (err) {
    throw new LtUpstreamError("liga_tennisa_invalid_json", resp.status, err);
  }

  const parsed = LtPlayerDetail.safeParse(json);
  if (!parsed.success) {
    throw new LtUpstreamError("liga_tennisa_schema_mismatch", resp.status, parsed.error);
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// Composite helper: search by name (and optional city) — used by the
// onboarding "find me on Liga Tennisa" modal.
// ---------------------------------------------------------------------------

export async function searchLtByName(
  query: string,
  options: { city?: string | null; limit?: number } = {},
): Promise<LtSearchCandidate[]> {
  if (!query || query.trim().length < 2) return [];
  const players = await fetchLtPlayers();
  return rankLtCandidates(players, query, options);
}
