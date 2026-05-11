// =============================================================================
// External-rating Zod schemas.
//
// We import data from external rating sources (currently only Liga Tennisa,
// https://www.ligatennisa.com/api/players[/<id>]). The upstream JSON exposes
// some fields we MUST never store — most notably `password_hash` and
// `last_password_reset` — and a heap of fields we simply don't need.
//
// The schemas in this file enforce a whitelist:
//   * `LtPlayerListItem` — shape of a single row in `/api/players`.
//   * `LtPlayerDetail`   — shape of a single row in `/api/players/<id>`
//     (adds elo_points / doubles_elo_points / singles_wins / ranking_position).
//   * `LtSafePayload`    — what we actually persist into `external_ratings.raw_payload`.
//     Built by `sanitiseLtPayload()`; sensitive fields are stripped at the
//     boundary so they can never leak into our DB.
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Permissive helpers for upstream noise.
// ---------------------------------------------------------------------------

/** LT often returns "" instead of null for unset string fields. */
const looseString = z.union([z.string(), z.null(), z.undefined()]).transform((v) => {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
});

/** Numbers (including 0). LT also returns "0" sometimes. */
const looseNumber = z.union([z.number(), z.string(), z.null(), z.undefined()]).transform((v) => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
});

const looseBool = z.union([z.boolean(), z.null(), z.undefined()]).transform((v) => v ?? false);

/**
 * LT exposes `date_of_birth` and `in_tennis_from` as ISO datetime strings
 * (`"1990-04-16T00:00:00.000Z"`) or null. We coerce to a `YYYY-MM-DD`
 * string so it lines up with `profiles.date_of_birth` (a Postgres `date`).
 */
const looseDate = z.union([z.string(), z.null(), z.undefined()]).transform((v) => {
  if (!v) return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
});

// ---------------------------------------------------------------------------
// Calibration metadata block.
// ---------------------------------------------------------------------------

const LtCalibrationSlot = z.object({
  isCalibrating: looseBool,
  matchesAgainstCalibrated: looseNumber,
});

const LtMetadata = z
  .object({
    singles: LtCalibrationSlot.optional(),
    doubles: LtCalibrationSlot.optional(),
  })
  .partial()
  .nullable()
  .optional();

// ---------------------------------------------------------------------------
// Common fields shared by list + detail endpoints.
//   - We pass `unknownKeys: "passthrough"` semantically by NOT using
//     `.strict()`: zod's default is to drop unknown keys (which is what we
//     want — anything new from upstream is silently dropped at the boundary).
// ---------------------------------------------------------------------------

const LtPlayerCommon = z.object({
  id: z.coerce.number().int().positive(),
  first_name: looseString,
  last_name: looseString,
  date_of_birth: looseDate,
  city: looseString,
  country: looseString,
  avatar: looseString,
  forehand: looseString,
  backhand: looseString,
  insta_link: looseString,
  in_tennis_from: looseDate,
  height: looseNumber,
  level: looseNumber,
  premium: looseBool,
  ratings_count: looseNumber,
  metadata: LtMetadata,
});

export const LtPlayerListItem = LtPlayerCommon;
export type LtPlayerListItem = z.infer<typeof LtPlayerListItem>;

export const LtPlayerListResponse = z.array(LtPlayerListItem);

export const LtPlayerDetail = LtPlayerCommon.extend({
  elo_points: looseNumber,
  doubles_elo_points: looseNumber,
  singles_wins: looseNumber,
  ranking_position: looseNumber,
});
export type LtPlayerDetail = z.infer<typeof LtPlayerDetail>;

// ---------------------------------------------------------------------------
// Sanitised payload — what we actually persist into `external_ratings.raw_payload`.
//
// We explicitly construct a NEW object rather than spreading the parsed
// upstream value, so nothing sneaks through. Sensitive fields the upstream
// API leaks (`password_hash`, `last_password_reset`, `email`, `phone`) are
// dropped here and never saved.
// ---------------------------------------------------------------------------

export const LtSafePayload = z.object({
  id: z.number().int().positive(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  avatar: z.string().nullable(),
  forehand: z.string().nullable(),
  backhand: z.string().nullable(),
  insta_link: z.string().nullable(),
  in_tennis_from: z.string().nullable(),
  height: z.number().nullable(),
  level: z.number().nullable(),
  premium: z.boolean(),
  ratings_count: z.number().nullable(),
  elo_points: z.number().nullable(),
  doubles_elo_points: z.number().nullable(),
  singles_wins: z.number().nullable(),
  ranking_position: z.number().nullable(),
  is_calibrating_singles: z.boolean(),
  is_calibrating_doubles: z.boolean(),
});
export type LtSafePayload = z.infer<typeof LtSafePayload>;

/**
 * Take a parsed `LtPlayerDetail` and produce the safe, whitelisted payload
 * that is OK to persist verbatim into `external_ratings.raw_payload`.
 *
 * NEVER pass the raw upstream JSON to the database — always go through this
 * function so sensitive fields are stripped at exactly one boundary.
 */
export function sanitiseLtPayload(detail: LtPlayerDetail): LtSafePayload {
  return LtSafePayload.parse({
    id: detail.id,
    first_name: detail.first_name,
    last_name: detail.last_name,
    date_of_birth: detail.date_of_birth,
    city: detail.city,
    country: detail.country,
    avatar: detail.avatar,
    forehand: detail.forehand,
    backhand: detail.backhand,
    insta_link: detail.insta_link,
    in_tennis_from: detail.in_tennis_from,
    height: detail.height,
    level: detail.level,
    premium: detail.premium,
    ratings_count: detail.ratings_count,
    elo_points: detail.elo_points,
    doubles_elo_points: detail.doubles_elo_points,
    singles_wins: detail.singles_wins,
    ranking_position: detail.ranking_position,
    is_calibrating_singles: detail.metadata?.singles?.isCalibrating ?? false,
    is_calibrating_doubles: detail.metadata?.doubles?.isCalibrating ?? false,
  });
}
