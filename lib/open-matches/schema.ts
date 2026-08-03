// =============================================================================
// Phase D — Zod schemas + shared types for Open Matches.
// =============================================================================
//
// Single source of truth: the form, the server action and the loader all
// depend on these. Postgres CHECK constraints are mirrored here so we get
// useful error messages before the round-trip.
// =============================================================================

import { z } from "zod";

export const OPEN_MATCH_FORMATS = ["singles", "doubles"] as const;
export type OpenMatchFormat = (typeof OPEN_MATCH_FORMATS)[number];

export const OPEN_MATCH_LEVEL_BANDS = [
  "any",
  "beginner",
  "improver",
  "confident",
  "strong",
  "elite",
] as const;
export type OpenMatchLevelBand = (typeof OPEN_MATCH_LEVEL_BANDS)[number];

export const OPEN_MATCH_STATUSES = ["open", "filled", "cancelled", "expired"] as const;
export type OpenMatchStatus = (typeof OPEN_MATCH_STATUSES)[number];

export const OPEN_MATCH_APP_STATUSES = ["pending", "accepted", "rejected", "withdrawn"] as const;
export type OpenMatchApplicationStatus = (typeof OPEN_MATCH_APP_STATUSES)[number];

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

export const CreateOpenMatchSchema = z
  .object({
    venue_id: z.string().uuid().nullable().optional(),
    starts_at: z.string().datetime({ offset: true }),
    duration_min: z.coerce.number().int().min(30).max(300).default(90),
    format: z.enum(OPEN_MATCH_FORMATS).default("singles"),
    level_band: z.enum(OPEN_MATCH_LEVEL_BANDS).default("any"),
    slots_needed: z.coerce.number().int().min(1).max(3).default(1),
    notes: z
      .string()
      .trim()
      .max(600)
      .nullish()
      .or(z.literal(""))
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .superRefine((data, ctx) => {
    // Singles → exactly 1 slot needed; doubles → 1, 2 or 3.
    if (data.format === "singles" && data.slots_needed !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots_needed"],
        message: "singles_one_slot_only",
      });
    }
    // starts_at must be in the future (15-minute grace).
    const startsMs = Date.parse(data.starts_at);
    if (!Number.isFinite(startsMs) || startsMs < Date.now() - 15 * 60 * 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["starts_at"],
        message: "starts_in_past",
      });
    }
    // A venue is required so applicants can find this match by location.
    // (The former district-only option was removed together with the
    // «Район» field — old district-only rows keep rendering fine.)
    if (!data.venue_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venue_id"],
        message: "location_required",
      });
    }
  });

export type CreateOpenMatchInput = z.input<typeof CreateOpenMatchSchema>;
export type CreateOpenMatchValues = z.output<typeof CreateOpenMatchSchema>;

// ---------------------------------------------------------------------------
// Apply form (player applies to an open match)
// ---------------------------------------------------------------------------

export const ApplyToOpenMatchSchema = z.object({
  open_match_id: z.string().uuid(),
  message: z
    .string()
    .trim()
    .max(400)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type ApplyToOpenMatchInput = z.input<typeof ApplyToOpenMatchSchema>;

// ---------------------------------------------------------------------------
// List filters (public feed)
// ---------------------------------------------------------------------------

export const OpenMatchesFilterSchema = z.object({
  venue_id: z.string().uuid().nullable().optional(),
  /** ISO alpha-2 country of the venue (or legacy district). */
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/u)
    .nullable()
    .optional(),
  level_band: z.enum(OPEN_MATCH_LEVEL_BANDS).optional(),
  format: z.enum(OPEN_MATCH_FORMATS).optional(),
  /** Only return rows whose `starts_at >= from`. Defaults to "now" in the loader. */
  from: z.string().datetime({ offset: true }).optional(),
  /** Only return rows whose `starts_at <= to`. */
  to: z.string().datetime({ offset: true }).optional(),
  status: z.enum(OPEN_MATCH_STATUSES).optional(),
});

export type OpenMatchesFilter = z.output<typeof OpenMatchesFilterSchema>;

// ---------------------------------------------------------------------------
// Output types (mirror open_matches_feed view)
// ---------------------------------------------------------------------------

/**
 * Slim Liga Tennisa snapshot attached to creator/applicant rows so the
 * shared `<RatingDisplay>` component can render the LT-in-parens badge.
 * Sourced via a batched secondary query on `external_ratings`.
 */
export type OpenMatchExternalRating = {
  source: "liga_tennisa";
  external_elo: number;
  external_url: string;
  display_tier: string;
  is_calibrating_singles: boolean;
};

export type OpenMatchFeedRow = {
  id: string;
  creator_id: string;
  creator_name: string | null;
  creator_avatar: string | null;
  creator_elo: number;
  creator_elo_status: "provisional" | "established";
  creator_external_rating: OpenMatchExternalRating | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_is_indoor: boolean | null;
  venue_indoor_status: "indoor" | "outdoor" | "mixed" | "unknown" | null;
  district_id: string | null;
  district_name: string | null;
  starts_at: string;
  duration_min: number;
  format: OpenMatchFormat;
  level_band: OpenMatchLevelBand;
  slots_needed: number;
  notes: string | null;
  status: OpenMatchStatus;
  created_at: string;
  pending_applications_count: number;
  accepted_applications_count: number;
  /** Venue country (falls back to the legacy district's country, then BY). */
  country: string;
};

export type OpenMatchApplicationRow = {
  id: string;
  open_match_id: string;
  applicant_id: string;
  applicant_name: string | null;
  applicant_avatar: string | null;
  applicant_elo: number;
  applicant_external_rating: OpenMatchExternalRating | null;
  message: string | null;
  status: OpenMatchApplicationStatus;
  created_at: string;
  decided_at: string | null;
};
