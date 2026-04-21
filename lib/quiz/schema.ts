import { z } from "zod";

// =============================================================================
// Zod schemas for the admin-facing quiz editor.
//
// They model exactly what the `quiz_questions` table accepts in its
// `question`, `options`, and `weight_formula` JSONB columns. The client
// renders different editors depending on `type`; the server validates the
// shape strictly so a malformed admin payload never lands in the DB.
// =============================================================================

export const QUIZ_QUESTION_TYPES = [
  "single_choice",
  "multi_choice",
  "scale",
  "number",
] as const;
export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

const Locale3 = z.object({
  pl: z.string().trim().min(1).max(500),
  en: z.string().trim().min(1).max(500),
  ru: z.string().trim().min(1).max(500),
});
export type LocaleText = z.infer<typeof Locale3>;

const ChoiceOption = z.object({
  value: z.string().trim().min(1).max(60),
  label: Locale3,
  weight: z.coerce.number().int().min(-2000).max(2000),
});

export const ScaleFormula = z.object({
  kind: z.literal("offset_linear"),
  center: z.coerce.number().min(0).max(20).default(5),
  coef: z.coerce.number().int().min(-200).max(200).default(20),
});

export const NumberFormula = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("linear"),
    coef: z.coerce.number().int().min(-200).max(200).optional(),
    coef_field: z.string().trim().max(80).optional(),
  }),
  z.object({
    kind: z.literal("step_per"),
    coef: z.coerce.number().int().min(-200).max(200).optional(),
    coef_field: z.string().trim().max(80).optional(),
    step: z.coerce.number().min(0.0001).max(1000).default(1),
  }),
]);

export const QuestionFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/i, "snake_case_only")
      .min(2)
      .max(60),
    position: z.coerce.number().int().min(1).max(99),
    required: z.boolean().default(true),
    question: Locale3,
    type: z.enum(QUIZ_QUESTION_TYPES),
    options_choices: z.array(ChoiceOption).optional(),
    options_scale: z
      .object({ min: z.coerce.number().int(), max: z.coerce.number().int() })
      .optional(),
    formula_scale: ScaleFormula.optional(),
    formula_number: NumberFormula.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "single_choice" || v.type === "multi_choice") {
      if (!v.options_choices || v.options_choices.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "need_at_least_2_options",
          path: ["options_choices"],
        });
      }
    }
    if (v.type === "scale") {
      if (!v.options_scale) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scale_range_required",
          path: ["options_scale"],
        });
      } else if (v.options_scale.max <= v.options_scale.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scale_max_gt_min",
          path: ["options_scale", "max"],
        });
      }
      if (!v.formula_scale) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scale_formula_required",
          path: ["formula_scale"],
        });
      }
    }
    if (v.type === "number") {
      if (!v.formula_number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "number_formula_required",
          path: ["formula_number"],
        });
      } else {
        const f = v.formula_number;
        if (f.coef === undefined && !f.coef_field) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "need_coef_or_coef_field",
            path: ["formula_number", "coef"],
          });
        }
      }
    }
  });

export type QuestionForm = z.infer<typeof QuestionFormSchema>;

// =============================================================================
// Rating algorithm config (admin editor).
// Mirrors the JSONB shape used by lib/rating/start-elo.ts and lib/rating/elo.ts.
// =============================================================================

export const AlgorithmConfigSchema = z.object({
  start_elo: z.object({
    base: z.coerce.number().int().min(100).max(3000),
    clamp: z
      .tuple([z.coerce.number().int(), z.coerce.number().int()])
      .refine(([lo, hi]) => hi > lo, { message: "clamp_max_gt_min" }),
    experience_per_year: z.coerce.number().int().min(-100).max(100),
    tournaments_bonus_per_5: z.coerce.number().int().min(-200).max(200),
  }),
  k_factors: z.object({
    provisional: z.coerce.number().int().min(8).max(80),
    intermediate: z.coerce.number().int().min(8).max(80),
    established: z.coerce.number().int().min(8).max(80),
    provisional_until_n_matches: z.coerce.number().int().min(0).max(50),
    intermediate_until_n_matches: z.coerce.number().int().min(1).max(200),
  }),
  multipliers: z.object({
    friendly: z.coerce.number().min(0).max(3),
    tournament: z.coerce.number().min(0).max(3),
    tournament_final: z.coerce.number().min(0).max(3),
  }),
  season: z.object({
    default_length_days: z.coerce.number().int().min(7).max(730),
    scoring: z.record(z.string(), z.coerce.number()),
    top_n_for_prizes: z.coerce.number().int().min(1).max(50),
  }),
});

export type AlgorithmConfig = z.infer<typeof AlgorithmConfigSchema>;

export const DEFAULT_ALGORITHM_CONFIG: AlgorithmConfig = {
  start_elo: {
    base: 1000,
    clamp: [400, 1900],
    experience_per_year: 25,
    tournaments_bonus_per_5: 30,
  },
  k_factors: {
    provisional: 40,
    intermediate: 32,
    established: 20,
    provisional_until_n_matches: 5,
    intermediate_until_n_matches: 30,
  },
  multipliers: {
    friendly: 0.5,
    tournament: 1.0,
    tournament_final: 1.25,
  },
  season: {
    default_length_days: 180,
    scoring: { tournament_win: 100, tournament_runner_up: 60, match_win: 5 },
    top_n_for_prizes: 3,
  },
};
