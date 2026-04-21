import type { QuizQuestionRow, RatingAlgorithmConfigRow } from "@/lib/supabase/types";

export type QuizAnswerValue = string | number | string[];
export type AnswerMap = Record<string, QuizAnswerValue>;

export type StartEloResult = {
  elo: number;
  raw: number;
  contributions: Array<{ code: string; weight: number }>;
  clamped: boolean;
};

/**
 * Resolve a coefficient referenced by a `weight_formula.coef_field` path
 * inside the algorithm config. Example: "start_elo.experience_per_year".
 */
function resolveCoef(
  config: RatingAlgorithmConfigRow["config"],
  path: string,
): number {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = config;
  for (const p of parts) {
    if (cur == null) return 0;
    cur = cur[p];
  }
  return typeof cur === "number" ? cur : 0;
}

/**
 * Compute a question's Elo contribution based on its type, options/formula
 * and the player's answer.
 */
function questionContribution(
  question: QuizQuestionRow,
  answer: QuizAnswerValue | undefined,
  config: RatingAlgorithmConfigRow["config"],
): number {
  if (answer === undefined || answer === null || answer === "") return 0;

  switch (question.type) {
    case "single_choice": {
      if (typeof answer !== "string") return 0;
      const opts = (question.options ?? []) as Array<{ value: string; weight: number }>;
      const found = opts.find((o) => o.value === answer);
      return found ? Number(found.weight) : 0;
    }

    case "multi_choice": {
      if (!Array.isArray(answer)) return 0;
      const opts = (question.options ?? []) as Array<{ value: string; weight: number }>;
      return answer.reduce((acc, v) => {
        const opt = opts.find((o) => o.value === v);
        return acc + (opt ? Number(opt.weight) : 0);
      }, 0);
    }

    case "scale": {
      const num = Number(answer);
      if (!Number.isFinite(num)) return 0;
      const f = (question.weight_formula ?? {}) as {
        kind?: string;
        center?: number;
        coef?: number;
      };
      if (f.kind === "offset_linear") {
        const center = typeof f.center === "number" ? f.center : 5;
        const coef = typeof f.coef === "number" ? f.coef : 0;
        return Math.round((num - center) * coef);
      }
      return 0;
    }

    case "number": {
      const num = Number(answer);
      if (!Number.isFinite(num) || num < 0) return 0;
      const f = (question.weight_formula ?? {}) as {
        kind?: string;
        coef?: number;
        coef_field?: string;
        step?: number;
      };
      const coef =
        typeof f.coef === "number"
          ? f.coef
          : f.coef_field
            ? resolveCoef(config, f.coef_field)
            : 0;

      if (f.kind === "linear") {
        return Math.round(num * coef);
      }
      if (f.kind === "step_per") {
        const step = typeof f.step === "number" && f.step > 0 ? f.step : 1;
        return Math.round(Math.floor(num / step) * coef);
      }
      return 0;
    }

    default:
      return 0;
  }
}

export function computeStartElo(
  questions: QuizQuestionRow[],
  answers: AnswerMap,
  config: RatingAlgorithmConfigRow["config"],
): StartEloResult {
  const base = config.start_elo.base;
  const [lo, hi] = config.start_elo.clamp;

  const contributions: Array<{ code: string; weight: number }> = [];
  let total = base;

  for (const q of questions) {
    const w = questionContribution(q, answers[q.code], config);
    contributions.push({ code: q.code, weight: w });
    total += w;
  }

  const clamped = total < lo || total > hi;
  const elo = Math.max(lo, Math.min(hi, Math.round(total)));

  return { elo, raw: total, contributions, clamped };
}
