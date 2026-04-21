"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  QuestionFormSchema,
  type QuestionForm,
  type QuizQuestionType,
} from "@/lib/quiz/schema";
import type { QuizQuestionRow, QuizVersionRow } from "@/lib/supabase/types";
import { computeStartElo, type AnswerMap } from "@/lib/rating/start-elo";

// =============================================================================
// Auth helper. RLS already gates these tables, but the route is also guarded
// by the (admin) layout. Keep both in sync.
// =============================================================================
async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  const { data } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!data?.is_admin) return { ok: false as const, error: "not_admin" as const };
  return { ok: true as const, supabase, userId: user.id };
}

// =============================================================================
// Versions: list / create (clone from active or empty) / activate / delete draft
// =============================================================================

export type VersionListItem = QuizVersionRow & {
  question_count: number;
  answer_count: number;
};

export async function loadQuizVersions(): Promise<
  { ok: true; versions: VersionListItem[] } | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: versions } = (await supabase
    .from("quiz_versions")
    .select("id, version, is_active, notes, created_at")
    .order("version", { ascending: false })) as {
    data: QuizVersionRow[] | null;
  };
  const list = versions ?? [];

  const ids = list.map((v) => v.id);
  const counts = new Map<string, { q: number; a: number }>();
  if (ids.length > 0) {
    const { data: qs } = (await supabase
      .from("quiz_questions")
      .select("version_id")
      .in("version_id", ids)) as { data: Array<{ version_id: string }> | null };
    for (const r of qs ?? []) {
      const e = counts.get(r.version_id) ?? { q: 0, a: 0 };
      e.q += 1;
      counts.set(r.version_id, e);
    }
    const { data: as } = (await supabase
      .from("quiz_answers")
      .select("version_id")
      .in("version_id", ids)) as { data: Array<{ version_id: string }> | null };
    for (const r of as ?? []) {
      const e = counts.get(r.version_id) ?? { q: 0, a: 0 };
      e.a += 1;
      counts.set(r.version_id, e);
    }
  }

  return {
    ok: true,
    versions: list.map((v) => ({
      ...v,
      question_count: counts.get(v.id)?.q ?? 0,
      answer_count: counts.get(v.id)?.a ?? 0,
    })),
  };
}

const CreateVersionSchema = z.object({
  source_version_id: z.string().uuid().nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function createQuizVersion(input: unknown): Promise<
  { ok: true; id: string; version: number } | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = CreateVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  const { supabase, userId } = auth;

  const { data: maxRow } = (await supabase
    .from("quiz_versions")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { version: number } | null };
  const nextVersion = (maxRow?.version ?? 0) + 1;

  const { data: created, error } = (await supabase
    .from("quiz_versions")
    .insert({
      version: nextVersion,
      is_active: false,
      notes: parsed.data.notes,
      created_by: userId,
    } as never)
    .select("id, version")
    .single()) as {
    data: { id: string; version: number } | null;
    error: { message: string } | null;
  };
  if (error || !created) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  // Optional: clone questions from another version.
  if (parsed.data.source_version_id) {
    const { data: srcQs } = (await supabase
      .from("quiz_questions")
      .select("position, code, type, question, options, weight_formula, required")
      .eq("version_id", parsed.data.source_version_id)
      .order("position", { ascending: true })) as {
      data: Array<Omit<QuizQuestionRow, "id" | "version_id">> | null;
    };
    if (srcQs && srcQs.length > 0) {
      await supabase.from("quiz_questions").insert(
        srcQs.map((q) => ({
          version_id: created.id,
          position: q.position,
          code: q.code,
          type: q.type,
          question: q.question,
          options: q.options,
          weight_formula: q.weight_formula,
          required: q.required,
        })) as never,
      );
    }
  }

  revalidatePath("/admin/quiz");
  return { ok: true, id: created.id, version: created.version };
}

export async function activateQuizVersion(
  versionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  // Refuse to activate an empty draft — saves the coach from a broken onboarding.
  const { data: q } = (await supabase
    .from("quiz_questions")
    .select("id")
    .eq("version_id", versionId)
    .limit(1)) as { data: Array<{ id: string }> | null };
  if (!q || q.length === 0) return { ok: false, error: "version_has_no_questions" };

  const { error: e1 } = await supabase
    .from("quiz_versions")
    .update({ is_active: false } as never)
    .neq("id", versionId);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase
    .from("quiz_versions")
    .update({ is_active: true } as never)
    .eq("id", versionId);
  if (e2) return { ok: false, error: e2.message };

  revalidatePath("/admin/quiz");
  revalidatePath("/onboarding/quiz");
  return { ok: true };
}

export async function deleteQuizVersion(
  versionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: v } = (await supabase
    .from("quiz_versions")
    .select("is_active")
    .eq("id", versionId)
    .maybeSingle()) as { data: { is_active: boolean } | null };
  if (!v) return { ok: false, error: "not_found" };
  if (v.is_active) return { ok: false, error: "cannot_delete_active" };

  const { data: ans } = (await supabase
    .from("quiz_answers")
    .select("id")
    .eq("version_id", versionId)
    .limit(1)) as { data: Array<{ id: string }> | null };
  if (ans && ans.length > 0) return { ok: false, error: "version_has_answers" };

  const { error } = await supabase.from("quiz_versions").delete().eq("id", versionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/quiz");
  return { ok: true };
}

// =============================================================================
// Questions: list / upsert / delete / reorder
// =============================================================================

export async function loadQuizVersionDetail(versionId: string): Promise<
  | {
      ok: true;
      version: QuizVersionRow;
      questions: QuizQuestionRow[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: version } = (await supabase
    .from("quiz_versions")
    .select("id, version, is_active, notes, created_at")
    .eq("id", versionId)
    .maybeSingle()) as { data: QuizVersionRow | null };
  if (!version) return { ok: false, error: "not_found" };

  const { data: questions } = (await supabase
    .from("quiz_questions")
    .select("id, version_id, position, code, type, question, options, weight_formula, required")
    .eq("version_id", versionId)
    .order("position", { ascending: true })) as { data: QuizQuestionRow[] | null };

  return { ok: true, version, questions: questions ?? [] };
}

/**
 * Build the JSONB `options` column from the discriminated form fields.
 */
function buildOptionsColumn(form: QuestionForm): QuizQuestionRow["options"] {
  if (form.type === "single_choice" || form.type === "multi_choice") {
    return (form.options_choices ?? []).map((o) => ({
      value: o.value,
      label: o.label,
      weight: o.weight,
    }));
  }
  if (form.type === "scale" && form.options_scale) {
    return { min: form.options_scale.min, max: form.options_scale.max };
  }
  return null;
}

function buildWeightFormulaColumn(
  form: QuestionForm,
): QuizQuestionRow["weight_formula"] {
  if (form.type === "scale" && form.formula_scale) {
    return { ...form.formula_scale };
  }
  if (form.type === "number" && form.formula_number) {
    return { ...form.formula_number };
  }
  return null;
}

const UpsertQuestionSchema = z.object({
  version_id: z.string().uuid(),
  question_id: z.string().uuid().nullable().optional(),
  form: QuestionFormSchema,
});

export async function upsertQuestion(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = UpsertQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { supabase } = auth;
  const { version_id, question_id, form } = parsed.data;

  // Active versions are locked — a coach who wants to change anything
  // must clone into a new draft, edit it, then activate.
  const { data: ver } = (await supabase
    .from("quiz_versions")
    .select("is_active")
    .eq("id", version_id)
    .maybeSingle()) as { data: { is_active: boolean } | null };
  if (!ver) return { ok: false, error: "version_not_found" };
  if (ver.is_active) return { ok: false, error: "active_version_locked" };

  const payload = {
    version_id,
    position: form.position,
    code: form.code,
    type: form.type as QuizQuestionType,
    question: form.question,
    options: buildOptionsColumn(form),
    weight_formula: buildWeightFormulaColumn(form),
    required: form.required,
  };

  if (question_id) {
    const { error } = await supabase
      .from("quiz_questions")
      .update(payload as never)
      .eq("id", question_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/quiz/${version_id}`);
    return { ok: true, id: question_id };
  } else {
    const { data, error } = (await supabase
      .from("quiz_questions")
      .insert(payload as never)
      .select("id")
      .single()) as {
      data: { id: string } | null;
      error: { message: string } | null;
    };
    if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };
    revalidatePath(`/admin/quiz/${version_id}`);
    return { ok: true, id: data.id };
  }
}

export async function deleteQuestion(
  versionId: string,
  questionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: ver } = (await supabase
    .from("quiz_versions")
    .select("is_active")
    .eq("id", versionId)
    .maybeSingle()) as { data: { is_active: boolean } | null };
  if (ver?.is_active) return { ok: false, error: "active_version_locked" };

  const { error } = await supabase
    .from("quiz_questions")
    .delete()
    .eq("id", questionId)
    .eq("version_id", versionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/quiz/${versionId}`);
  return { ok: true };
}

export async function moveQuestion(
  versionId: string,
  questionId: string,
  direction: "up" | "down",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: ver } = (await supabase
    .from("quiz_versions")
    .select("is_active")
    .eq("id", versionId)
    .maybeSingle()) as { data: { is_active: boolean } | null };
  if (ver?.is_active) return { ok: false, error: "active_version_locked" };

  const { data: questions } = (await supabase
    .from("quiz_questions")
    .select("id, position")
    .eq("version_id", versionId)
    .order("position", { ascending: true })) as {
    data: Array<{ id: string; position: number }> | null;
  };
  if (!questions) return { ok: false, error: "load_failed" };

  const idx = questions.findIndex((q) => q.id === questionId);
  if (idx < 0) return { ok: false, error: "not_found" };
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= questions.length) return { ok: true };

  const a = questions[idx];
  const b = questions[swapIdx];
  // Two-phase swap to avoid the (version_id, position) unique conflict.
  await supabase
    .from("quiz_questions")
    .update({ position: -1 } as never)
    .eq("id", a.id);
  await supabase
    .from("quiz_questions")
    .update({ position: a.position } as never)
    .eq("id", b.id);
  await supabase
    .from("quiz_questions")
    .update({ position: b.position } as never)
    .eq("id", a.id);

  revalidatePath(`/admin/quiz/${versionId}`);
  return { ok: true };
}

// =============================================================================
// Preview / dry-run: feed answers through the active algorithm config.
// =============================================================================

export async function previewQuiz(
  versionId: string,
  answers: AnswerMap,
): Promise<
  | { ok: true; elo: number; clamped: boolean; contributions: Array<{ code: string; weight: number }> }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: questions } = (await supabase
    .from("quiz_questions")
    .select("id, version_id, position, code, type, question, options, weight_formula, required")
    .eq("version_id", versionId)
    .order("position", { ascending: true })) as {
    data: QuizQuestionRow[] | null;
  };
  if (!questions || questions.length === 0)
    return { ok: false, error: "no_questions" };

  const { data: cfg } = (await supabase
    .from("rating_algorithm_config")
    .select("config")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data: { config: import("@/lib/supabase/types").RatingAlgorithmConfigRow["config"] } | null;
  };
  if (!cfg) return { ok: false, error: "no_active_algorithm" };

  const result = computeStartElo(questions, answers, cfg.config);
  return {
    ok: true,
    elo: result.elo,
    clamped: result.clamped,
    contributions: result.contributions,
  };
}
