"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { QuizQuestionRow, QuizVersionRow } from "@/lib/supabase/types";
import { activateQuizVersion, deleteQuestion, moveQuestion } from "../actions";
import { QuestionFormDialog } from "./question-form-dialog";

export function QuestionsClient({
  locale,
  version,
  questions,
}: {
  locale: "pl" | "en" | "ru";
  version: QuizVersionRow;
  questions: QuizQuestionRow[];
}) {
  const t = useTranslations("adminQuiz");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuizQuestionRow | null>(null);

  const locked = version.is_active;
  const nextPosition =
    questions.length > 0 ? Math.max(...questions.map((q) => q.position)) + 1 : 1;

  function handleDelete(q: QuizQuestionRow) {
    if (!confirm(t("question.confirm_delete"))) return;
    setError(null);
    start(async () => {
      const res = await deleteQuestion(version.id, q.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleMove(q: QuizQuestionRow, dir: "up" | "down") {
    setError(null);
    start(async () => {
      const res = await moveQuestion(version.id, q.id, dir);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleActivate() {
    setError(null);
    start(async () => {
      const res = await activateQuizVersion(version.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-grass-200 bg-grass-50 px-3 py-2 text-sm text-grass-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("locked_active")}</p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">
          {t("question.list_count", { n: questions.length })}
        </p>
        <div className="flex gap-2">
          {!locked && questions.length > 0 && (
            <button
              onClick={handleActivate}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-grass-300 bg-grass-50 px-3 text-sm font-medium text-grass-800 hover:bg-grass-100 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {t("activate_version")}
            </button>
          )}
          <button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={locked}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-clay-500 px-3 text-sm font-medium text-white shadow-card hover:bg-clay-600 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t("question.add")}
          </button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-clay-400" />
          <p className="mt-2 font-display text-lg text-ink-900">
            {t("question.empty_title")}
          </p>
          <p className="text-sm text-ink-600">{t("question.empty_body")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {questions.map((q, i) => (
            <li
              key={q.id}
              className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clay-50 font-mono text-xs font-semibold text-clay-700">
                  {q.position}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-mono uppercase text-ink-700">
                      {t(`question.types.${q.type}`)}
                    </span>
                    <code className="rounded bg-grass-50 px-1.5 py-0.5 text-xs font-mono text-grass-800">
                      {q.code}
                    </code>
                    {q.required && (
                      <span className="text-[10px] uppercase tracking-wider text-clay-700">
                        {t("question.required_short")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-ink-900">
                    {q.question[locale] || q.question.en || q.question.pl || "—"}
                  </p>
                  <QuestionPreview q={q} t={t} />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => handleMove(q, "up")}
                    disabled={locked || pending || i === 0}
                    title={t("question.move_up")}
                    className="rounded-md p-1 text-ink-500 hover:bg-ink-100 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMove(q, "down")}
                    disabled={locked || pending || i === questions.length - 1}
                    title={t("question.move_down")}
                    className="rounded-md p-1 text-ink-500 hover:bg-ink-100 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => {
                      setEditing(q);
                      setDialogOpen(true);
                    }}
                    disabled={locked}
                    title={t("question.edit")}
                    className="rounded-md border border-ink-200 p-1.5 text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    disabled={locked || pending}
                    title={t("question.delete")}
                    className="rounded-md border border-clay-200 p-1.5 text-clay-700 hover:bg-clay-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <QuestionFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        versionId={version.id}
        initial={editing}
        defaultPosition={editing?.position ?? nextPosition}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function QuestionPreview({
  q,
  t,
}: {
  q: QuizQuestionRow;
  t: ReturnType<typeof useTranslations>;
}) {
  if (q.type === "single_choice" || q.type === "multi_choice") {
    const opts = (q.options ?? []) as Array<{
      value: string;
      label: { pl?: string; en?: string; ru?: string };
      weight: number;
    }>;
    return (
      <ul className="mt-2 space-y-0.5 text-xs text-ink-600">
        {opts.map((o) => (
          <li key={o.value} className="flex justify-between">
            <span>
              <code className="text-[10px] text-ink-400">{o.value}</code>{" "}
              {o.label?.en ?? o.label?.pl ?? "—"}
            </span>
            <span className="font-mono">
              {o.weight > 0 ? `+${o.weight}` : o.weight}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (q.type === "scale") {
    const o = q.options as { min: number; max: number } | null;
    const f = q.weight_formula as { center?: number; coef?: number } | null;
    return (
      <p className="mt-2 text-xs text-ink-500">
        {t("question.scale_summary", {
          min: o?.min ?? 0,
          max: o?.max ?? 0,
          center: f?.center ?? 0,
          coef: f?.coef ?? 0,
        })}
      </p>
    );
  }
  if (q.type === "number") {
    const f = q.weight_formula as
      | { kind?: string; coef?: number; coef_field?: string; step?: number }
      | null;
    return (
      <p className="mt-2 text-xs text-ink-500">
        {t("question.number_summary", {
          kind: f?.kind ?? "linear",
          coef: f?.coef ?? 0,
          coefField: f?.coef_field ?? "—",
        })}
      </p>
    );
  }
  return null;
}
