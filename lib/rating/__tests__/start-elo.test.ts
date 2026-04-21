import { describe, it, expect } from "vitest";
import { computeStartElo, type AnswerMap } from "../start-elo";
import type { QuizQuestionRow, RatingAlgorithmConfigRow } from "@/lib/supabase/types";

const config: RatingAlgorithmConfigRow["config"] = {
  start_elo: {
    base: 1000,
    clamp: [800, 2200],
    experience_per_year: 20,
    tournaments_bonus_per_5: 50,
  },
  k_factors: {
    provisional: 60,
    intermediate: 32,
    established: 20,
    provisional_until_n_matches: 10,
    intermediate_until_n_matches: 30,
  },
  multipliers: { friendly: 0.5, tournament: 1.0, tournament_final: 1.25 },
  season: {
    default_length_days: 182,
    scoring: { match_win: 10, match_loss: 1 },
    top_n_for_prizes: 3,
  },
  margin_of_victory_enabled: false,
};

const questions: QuizQuestionRow[] = [
  {
    id: "q1",
    version_id: "v1",
    position: 1,
    code: "years_played",
    type: "number",
    question: { pl: "lat", en: "yrs", ru: "лет" },
    options: null,
    weight_formula: { kind: "linear", coef_field: "start_elo.experience_per_year" },
    required: true,
  },
  {
    id: "q2",
    version_id: "v1",
    position: 2,
    code: "frequency_per_week",
    type: "single_choice",
    question: { pl: "?", en: "?", ru: "?" },
    options: [
      { value: "rare", label: { pl: "", en: "", ru: "" }, weight: 0 },
      { value: "1_2", label: { pl: "", en: "", ru: "" }, weight: 30 },
      { value: "3_plus", label: { pl: "", en: "", ru: "" }, weight: 80 },
    ],
    weight_formula: null,
    required: true,
  },
  {
    id: "q3",
    version_id: "v1",
    position: 3,
    code: "serve_self_eval",
    type: "scale",
    question: { pl: "", en: "", ru: "" },
    options: { min: 1, max: 10 },
    weight_formula: { kind: "offset_linear", center: 5, coef: 15 },
    required: true,
  },
  {
    id: "q4",
    version_id: "v1",
    position: 4,
    code: "tournaments_played",
    type: "number",
    question: { pl: "", en: "", ru: "" },
    options: null,
    weight_formula: { kind: "step_per", step: 5, coef_field: "start_elo.tournaments_bonus_per_5" },
    required: true,
  },
  {
    id: "q5",
    version_id: "v1",
    position: 5,
    code: "current_self_estimate",
    type: "single_choice",
    question: { pl: "", en: "", ru: "" },
    options: [
      { value: "beginner", label: { pl: "", en: "", ru: "" }, weight: -100 },
      { value: "intermediate", label: { pl: "", en: "", ru: "" }, weight: 0 },
      { value: "advanced", label: { pl: "", en: "", ru: "" }, weight: 200 },
      { value: "expert", label: { pl: "", en: "", ru: "" }, weight: 400 },
    ],
    weight_formula: null,
    required: true,
  },
];

describe("computeStartElo", () => {
  it("returns base when no answers", () => {
    const result = computeStartElo(questions, {}, config);
    expect(result.elo).toBe(1000);
    expect(result.raw).toBe(1000);
    expect(result.clamped).toBe(false);
  });

  it("adds linear (years_played * 20)", () => {
    const answers: AnswerMap = { years_played: 5 };
    const result = computeStartElo(questions, answers, config);
    expect(result.elo).toBe(1100);
  });

  it("adds single_choice weight", () => {
    const answers: AnswerMap = { frequency_per_week: "3_plus" };
    expect(computeStartElo(questions, answers, config).elo).toBe(1080);
  });

  it("computes scale offset_linear: 8 → (8-5)*15 = +45", () => {
    const answers: AnswerMap = { serve_self_eval: 8 };
    expect(computeStartElo(questions, answers, config).elo).toBe(1045);
  });

  it("computes step_per: 12 tournaments → floor(12/5)*50 = 100", () => {
    const answers: AnswerMap = { tournaments_played: 12 };
    expect(computeStartElo(questions, answers, config).elo).toBe(1100);
  });

  it("clamps high: massive over-rating capped at 2200", () => {
    const answers: AnswerMap = {
      years_played: 200,
      frequency_per_week: "3_plus",
      serve_self_eval: 10,
      tournaments_played: 200,
      current_self_estimate: "expert",
    };
    const r = computeStartElo(questions, answers, config);
    expect(r.elo).toBe(2200);
    expect(r.clamped).toBe(true);
  });

  it("clamps low: very negative answers capped at 800", () => {
    const answers: AnswerMap = {
      current_self_estimate: "beginner",
      serve_self_eval: 1,
    };
    const r = computeStartElo(questions, answers, config);
    expect(r.elo).toBeGreaterThanOrEqual(800);
    expect(r.elo).toBeLessThan(1000);
  });

  it("realistic intermediate player", () => {
    const answers: AnswerMap = {
      years_played: 3,
      frequency_per_week: "1_2",
      serve_self_eval: 6,
      tournaments_played: 4,
      current_self_estimate: "intermediate",
    };
    const r = computeStartElo(questions, answers, config);
    // 1000 + (3*20) + 30 + ((6-5)*15) + 0 + 0 = 1105
    expect(r.elo).toBe(1105);
    expect(r.clamped).toBe(false);
  });

  it("provides per-question contributions for transparency", () => {
    const answers: AnswerMap = { years_played: 2, frequency_per_week: "1_2" };
    const r = computeStartElo(questions, answers, config);
    const yp = r.contributions.find((c) => c.code === "years_played");
    const fr = r.contributions.find((c) => c.code === "frequency_per_week");
    expect(yp?.weight).toBe(40);
    expect(fr?.weight).toBe(30);
  });
});
