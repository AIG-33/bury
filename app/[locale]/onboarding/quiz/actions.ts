"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { computeStartElo, type AnswerMap } from "@/lib/rating/start-elo";
import type {
  QuizQuestionRow,
  QuizVersionRow,
  RatingAlgorithmConfigRow,
} from "@/lib/supabase/types";

const SubmitSchema = z.object({
  versionId: z.string().uuid(),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])),
});

export type ActiveQuizPayload = {
  version: { id: string; version: number };
  questions: QuizQuestionRow[];
};

export async function loadActiveQuiz(): Promise<ActiveQuizPayload> {
  const supabase = await createSupabaseServerClient();

  const { data: version, error: vErr } = (await supabase
    .from("quiz_versions")
    .select("id, version")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .single()) as { data: Pick<QuizVersionRow, "id" | "version"> | null; error: unknown };

  if (vErr || !version) {
    throw new Error("no_active_quiz_version");
  }

  const { data: questions, error: qErr } = (await supabase
    .from("quiz_questions")
    .select("id, version_id, position, code, type, question, options, weight_formula, required")
    .eq("version_id", version.id)
    .order("position", { ascending: true })) as {
    data: QuizQuestionRow[] | null;
    error: unknown;
  };

  if (qErr || !questions) {
    throw new Error("failed_to_load_questions");
  }

  return { version, questions };
}

export type SubmitResult =
  | { ok: true; elo: number; clamped: boolean }
  | { ok: false; error: string };

export async function submitQuiz(input: unknown): Promise<SubmitResult> {
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_payload" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: questions } = (await supabase
    .from("quiz_questions")
    .select("id, version_id, position, code, type, question, options, weight_formula, required")
    .eq("version_id", parsed.data.versionId)) as { data: QuizQuestionRow[] | null };

  if (!questions || questions.length === 0) {
    return { ok: false, error: "version_not_found" };
  }

  const { data: algoRow } = (await supabase
    .from("rating_algorithm_config")
    .select("config")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .single()) as { data: { config: RatingAlgorithmConfigRow["config"] } | null };

  if (!algoRow) {
    return { ok: false, error: "no_active_algorithm" };
  }

  const result = computeStartElo(questions, parsed.data.answers as AnswerMap, algoRow.config);

  // Use service client to bypass RLS for the writes that span profiles + history.
  const service = createSupabaseServiceClient();

  const { error: insErr } = await service.from("quiz_answers").upsert(
    {
      player_id: user.id,
      version_id: parsed.data.versionId,
      answers: parsed.data.answers,
      computed_elo: result.elo,
    } as never,
    { onConflict: "player_id,version_id" },
  );
  if (insErr) return { ok: false, error: insErr.message };

  // Read existing elo for the rating_history old_elo value
  const { data: existing } = (await service
    .from("profiles")
    .select("current_elo")
    .eq("id", user.id)
    .single()) as { data: { current_elo: number } | null };

  const oldElo = existing?.current_elo ?? 1000;

  const { error: profErr } = await service
    .from("profiles")
    .update({
      current_elo: result.elo,
      elo_status: "provisional",
      onboarding_completed_at: new Date().toISOString(),
    } as never)
    .eq("id", user.id);
  if (profErr) return { ok: false, error: profErr.message };

  await service.from("rating_history").insert({
    player_id: user.id,
    match_id: null,
    old_elo: oldElo,
    new_elo: result.elo,
    k_factor: algoRow.config.k_factors.provisional,
    multiplier: 1.0,
    reason: "onboarding",
  } as never);

  revalidatePath("/", "layout");
  return { ok: true, elo: result.elo, clamped: result.clamped };
}
