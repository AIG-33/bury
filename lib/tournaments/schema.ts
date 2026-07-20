import { z } from "zod";

// ─── Catalogue values ────────────────────────────────────────────────────────

export const TOURNAMENT_FORMATS = [
  "single_elimination",
  "double_elimination",
  "round_robin",
  "group_playoff",
  "swiss",
  "compass",
] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const SUPPORTED_FORMATS_MVP: TournamentFormat[] = [
  "single_elimination",
  "round_robin",
  "group_playoff",
];

// Singles (default) vs doubles. In a doubles tournament every participant
// row is a PAIR (player_id = captain, partner_id = partner); matches are
// written with is_doubles + partner columns and rate the doubles Elo ladder.
export const TOURNAMENT_DISCIPLINES = ["singles", "doubles"] as const;
export type TournamentDiscipline = (typeof TOURNAMENT_DISCIPLINES)[number];

// Power-of-two bracket sizes that can be picked when the organiser closes the
// group stage of a hybrid tournament. 2 = direct final, 4 = semis, etc.
export const PLAYOFF_SIZES = [2, 4, 8, 16, 32] as const;
export type PlayoffSize = (typeof PLAYOFF_SIZES)[number];

// Stages a match can belong to inside a hybrid tournament. Null = legacy
// single-elim / round-robin tournament that pre-dates this enum.
export const MATCH_STAGES = ["group", "playoff", "third_place"] as const;
export type MatchStage = (typeof MATCH_STAGES)[number];

export const TOURNAMENT_STATUSES = [
  "draft",
  "registration",
  "in_progress",
  "finished",
  "cancelled",
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const SEEDING_METHODS = ["rating", "random", "manual"] as const;
export type SeedingMethod = (typeof SEEDING_METHODS)[number];

export const PRIVACY_OPTIONS = ["club", "public"] as const;
export type Privacy = (typeof PRIVACY_OPTIONS)[number];

// How player applications get confirmed: 'manual' — the organizer approves
// each one by hand (historical behaviour, default); 'auto' — an application
// is approved immediately while registration is open and seats remain.
export const APPLICATION_MODES = ["manual", "auto"] as const;
export type ApplicationMode = (typeof APPLICATION_MODES)[number];

export const SURFACES = ["hard", "clay", "grass", "carpet"] as const;
export type Surface = (typeof SURFACES)[number];

// ─── Match rules (stored as JSONB) ───────────────────────────────────────────

export const MATCH_RULE_KINDS = [
  "best_of_3",
  "best_of_5",
  "single_set",
  "pro_set",
  "first_to_games",
  "timed",
] as const;
export type MatchRuleKind = (typeof MATCH_RULE_KINDS)[number];

/**
 * Free-form match rules. Kept as a single discriminated union to:
 *   – render a simple selector in the coach form,
 *   – be self-contained when stored as JSONB on the tournament row.
 *
 * Defaults match standard amateur tennis: best-of-3 sets, no-ad off,
 * super-tiebreak in lieu of 3rd set is OFF unless explicitly enabled.
 */
export const MatchRulesSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("best_of_3"),
    // Up to 10 so "tiebreak sets" (each set is a race to 10) are possible.
    set_target: z.number().int().min(4).max(10).default(6),
    no_ad: z.boolean().default(false),
    super_tiebreak_decider: z.boolean().default(false),
    set_tiebreak_at: z.number().int().min(5).max(10).default(6),
  }),
  z.object({
    kind: z.literal("best_of_5"),
    set_target: z.number().int().min(4).max(10).default(6),
    no_ad: z.boolean().default(false),
    set_tiebreak_at: z.number().int().min(5).max(10).default(6),
  }),
  z.object({
    kind: z.literal("single_set"),
    set_target: z.number().int().min(4).max(10).default(6),
    no_ad: z.boolean().default(false),
    set_tiebreak_at: z.number().int().min(5).max(10).default(6),
  }),
  z.object({
    kind: z.literal("pro_set"),
    target_games: z.number().int().min(7).max(12).default(8),
    no_ad: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("first_to_games"),
    target_games: z.number().int().min(2).max(15).default(4),
    no_ad: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("timed"),
    minutes: z.number().int().min(15).max(180).default(45),
    no_ad: z.boolean().default(false),
  }),
]);

export type MatchRules = z.infer<typeof MatchRulesSchema>;

export const DEFAULT_MATCH_RULES: MatchRules = {
  kind: "best_of_3",
  set_target: 6,
  no_ad: false,
  super_tiebreak_decider: false,
  set_tiebreak_at: 6,
};

// ─── Tournament form ─────────────────────────────────────────────────────────

// Accept string | "" | null | undefined and normalise to a trimmed string or null.
// Using preprocess avoids the "Invalid input" error you get from a chained
// `.optional().or(z.literal(""))` when react-hook-form sends `null` for an
// untouched optional field.
const optionalText = z.preprocess((v) => {
  if (v == null) return null;
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.string().max(2000).nullable());

const optionalDateString = z.preprocess(
  (v) => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim().length === 0) return null;
    return v;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .nullable(),
);

const optionalIntInRange = (min: number, max: number) =>
  z.preprocess((v) => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim().length === 0) return null;
    return v;
  }, z.coerce.number().int().min(min).max(max).nullable());

// HH:MM (24h). Stored in `tournaments.start_time` as `time without time zone`,
// interpreted in Europe/Minsk per AGENTS.md §1. Optional.
const optionalTimeOfDay = z.preprocess(
  (v) => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim().length === 0) return null;
    return v;
  },
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM")
    .nullable(),
);

export const TournamentFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText,
  format: z.enum(TOURNAMENT_FORMATS).default("single_elimination"),
  // Locked once the tournament has participants — flipping it would orphan
  // solo registrations (or strand pairs in a singles draw).
  discipline: z.enum(TOURNAMENT_DISCIPLINES).default("singles"),
  surface: z.enum(SURFACES).optional().nullable(),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
  start_time: optionalTimeOfDay,
  ends_on: optionalDateString,
  registration_deadline: optionalDateString,
  max_participants: optionalIntInRange(2, 128),
  entry_fee_byn: optionalIntInRange(0, 100000),
  privacy: z.enum(PRIVACY_OPTIONS).default("club"),
  application_mode: z.enum(APPLICATION_MODES).default("manual"),
  // Optional link to a club the organiser owns/administers. Club tournaments
  // feed that club's internal rating. Empty = a standalone tournament.
  club_id: z
    .preprocess((v) => (v == null || v === "" ? null : v), z.string().uuid().nullable())
    .default(null),
  draw_method: z.enum(SEEDING_METHODS).default("rating"),
  prizes_description: optionalText,
  match_rules: MatchRulesSchema.default(DEFAULT_MATCH_RULES),
  // Empty array = no venues bound (e.g. "TBD"). Order is not significant.
  venue_ids: z.array(z.string().uuid()).max(20).default([]),
  // Hybrid (group + playoff) tournaments only — toggles a 3rd-place match
  // between the two losing semi-finalists. Ignored for other formats.
  third_place_match: z.boolean().default(false),
});

export type TournamentForm = z.infer<typeof TournamentFormSchema>;

// ─── Hybrid (group + playoff) tournament management ──────────────────────────

/**
 * Step 1 of the hybrid flow: organiser closes registration and tells us
 * (a) how many groups to split approved players into and (b) which method
 * to use to seed the groups. Manual = round-robin into A, B, … by Elo as a
 * starting point; the organiser then drags individual players between
 * groups before any group match has a score.
 */
export const GenerateGroupsSchema = z.object({
  tournament_id: z.string().uuid(),
  groups_count: z.coerce.number().int().min(2).max(16),
  method: z.enum(SEEDING_METHODS).default("rating"),
  rng_seed: z.coerce.number().int().min(0).max(2_000_000_000).optional().nullable(),
});
export type GenerateGroupsInput = z.infer<typeof GenerateGroupsSchema>;

/**
 * Step 2: every group match has a result, organiser picks the playoff size
 * and how many players advance from every group. Total qualifiers
 * (groups_count × advance_per_group) must be ≤ playoff_size; unfilled
 * slots become byes for the top seeds.
 */
export const CloseGroupsSchema = z.object({
  tournament_id: z.string().uuid(),
  advance_per_group: z.coerce.number().int().min(1).max(8),
  playoff_size: z.coerce.number().int().refine((n) => PLAYOFF_SIZES.includes(n as PlayoffSize), {
    message: "expected one of 2/4/8/16/32",
  }),
});
export type CloseGroupsInput = z.infer<typeof CloseGroupsSchema>;

/**
 * Drag-and-drop reassignment between groups. Only legal while every group
 * match is still pending (no scores entered yet) — the SA enforces this.
 */
export const MoveToGroupSchema = z.object({
  participant_id: z.string().uuid(),
  group_id: z.string().uuid(),
});
export type MoveToGroupInput = z.infer<typeof MoveToGroupSchema>;

// ─── Score entry ─────────────────────────────────────────────────────────────

/**
 * Each set: [p1_games, p2_games]. Optionally a tiebreak `tb` slot stored on
 * the set when applicable. Validation happens server-side based on the
 * tournament's match_rules.
 */
export const ScoreSetSchema = z.object({
  p1: z.coerce.number().int().min(0).max(20),
  p2: z.coerce.number().int().min(0).max(20),
  tb_p1: z.coerce.number().int().min(0).max(50).optional().nullable(),
  tb_p2: z.coerce.number().int().min(0).max(50).optional().nullable(),
});

export type ScoreSet = z.infer<typeof ScoreSetSchema>;

export const MatchOutcomeInputs = [
  "completed",
  "walkover_p1",
  "walkover_p2",
  "retired_p1",
  "retired_p2",
  "dsq_p1",
  "dsq_p2",
] as const;
export type MatchOutcomeInput = (typeof MatchOutcomeInputs)[number];

export const ScoreFormSchema = z.object({
  match_id: z.string().uuid(),
  outcome: z.enum(MatchOutcomeInputs).default("completed"),
  sets: z.array(ScoreSetSchema).min(0).max(5),
});

export type ScoreForm = z.infer<typeof ScoreFormSchema>;

// ─── Participant management ──────────────────────────────────────────────────

export const AddParticipantSchema = z.object({
  tournament_id: z.string().uuid(),
  player_id: z.string().uuid(),
  // Required (validated in the action) when the tournament is doubles;
  // must stay null for singles.
  partner_id: z.string().uuid().optional().nullable(),
  seed: z.coerce.number().int().min(1).max(256).optional().nullable(),
});
