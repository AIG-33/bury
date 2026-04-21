"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  QUIZ_QUESTION_TYPES,
  type QuizQuestionType,
} from "@/lib/quiz/schema";
import type { QuizQuestionRow } from "@/lib/supabase/types";
import { upsertQuestion } from "../actions";

type Choice = {
  value: string;
  label: { pl: string; en: string; ru: string };
  weight: number;
};

type FormState = {
  code: string;
  position: number;
  required: boolean;
  question: { pl: string; en: string; ru: string };
  type: QuizQuestionType;
  options_choices: Choice[];
  options_scale: { min: number; max: number };
  formula_scale: { kind: "offset_linear"; center: number; coef: number };
  formula_number: {
    kind: "linear" | "step_per";
    coef?: number;
    coef_field?: string;
    step?: number;
  };
};

const EMPTY_FORM: FormState = {
  code: "",
  position: 1,
  required: true,
  question: { pl: "", en: "", ru: "" },
  type: "single_choice",
  options_choices: [
    { value: "a", label: { pl: "", en: "", ru: "" }, weight: 0 },
    { value: "b", label: { pl: "", en: "", ru: "" }, weight: 50 },
  ],
  options_scale: { min: 1, max: 10 },
  formula_scale: { kind: "offset_linear", center: 5, coef: 20 },
  formula_number: { kind: "linear", coef: 25, step: 1 },
};

function fromRow(row: QuizQuestionRow): FormState {
  const base: FormState = {
    ...EMPTY_FORM,
    code: row.code,
    position: row.position,
    required: row.required,
    question: {
      pl: row.question.pl ?? "",
      en: row.question.en ?? "",
      ru: row.question.ru ?? "",
    },
    type: row.type,
  };
  if (row.type === "single_choice" || row.type === "multi_choice") {
    const opts = (row.options ?? []) as Array<{
      value: string;
      label: { pl?: string; en?: string; ru?: string };
      weight: number;
    }>;
    if (Array.isArray(opts) && opts.length > 0) {
      base.options_choices = opts.map((o) => ({
        value: o.value,
        label: { pl: o.label?.pl ?? "", en: o.label?.en ?? "", ru: o.label?.ru ?? "" },
        weight: o.weight,
      }));
    }
  }
  if (row.type === "scale") {
    const o = row.options as { min: number; max: number } | null;
    if (o) base.options_scale = { min: o.min, max: o.max };
    const f = row.weight_formula as { center?: number; coef?: number } | null;
    if (f) {
      base.formula_scale = {
        kind: "offset_linear",
        center: f.center ?? 5,
        coef: f.coef ?? 20,
      };
    }
  }
  if (row.type === "number") {
    const f = row.weight_formula as
      | { kind?: "linear" | "step_per"; coef?: number; coef_field?: string; step?: number }
      | null;
    if (f) {
      base.formula_number = {
        kind: f.kind === "step_per" ? "step_per" : "linear",
        coef: f.coef,
        coef_field: f.coef_field,
        step: f.step ?? 1,
      };
    }
  }
  return base;
}

export function QuestionFormDialog({
  open,
  onClose,
  versionId,
  initial,
  defaultPosition,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  versionId: string;
  initial?: QuizQuestionRow | null;
  defaultPosition: number;
  onSaved: () => void;
}) {
  const t = useTranslations("adminQuiz.question");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (initial) setForm(fromRow(initial));
    else setForm({ ...EMPTY_FORM, position: defaultPosition });
    setError(null);
  }, [open, initial, defaultPosition]);

  if (!open) return null;

  function setQ(lang: "pl" | "en" | "ru", v: string) {
    setForm((s) => ({ ...s, question: { ...s.question, [lang]: v } }));
  }

  function setChoice(idx: number, patch: Partial<Choice>) {
    setForm((s) => {
      const next = [...s.options_choices];
      next[idx] = {
        ...next[idx],
        ...patch,
        label: { ...next[idx].label, ...(patch.label ?? {}) },
      };
      return { ...s, options_choices: next };
    });
  }

  function addChoice() {
    setForm((s) => ({
      ...s,
      options_choices: [
        ...s.options_choices,
        {
          value: `o${s.options_choices.length + 1}`,
          label: { pl: "", en: "", ru: "" },
          weight: 0,
        },
      ],
    }));
  }

  function removeChoice(idx: number) {
    setForm((s) => ({
      ...s,
      options_choices: s.options_choices.filter((_, i) => i !== idx),
    }));
  }

  function handleSubmit() {
    setError(null);
    start(async () => {
      const payload = {
        version_id: versionId,
        question_id: initial?.id ?? null,
        form: {
          code: form.code,
          position: form.position,
          required: form.required,
          question: form.question,
          type: form.type,
          options_choices:
            form.type === "single_choice" || form.type === "multi_choice"
              ? form.options_choices
              : undefined,
          options_scale: form.type === "scale" ? form.options_scale : undefined,
          formula_scale: form.type === "scale" ? form.formula_scale : undefined,
          formula_number: form.type === "number" ? form.formula_number : undefined,
        },
      };
      const res = await upsertQuestion(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl2 bg-white p-5 shadow-ace"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink-900">
            {initial ? t("title_edit") : t("title_create")}
          </h3>
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-md p-1 text-ink-500 hover:bg-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("code")}>
            <input
              value={form.code}
              onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
              placeholder="years_playing"
              className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm font-mono"
            />
          </Field>
          <Field label={t("position")}>
            <input
              type="number"
              value={form.position}
              onChange={(e) =>
                setForm((s) => ({ ...s, position: Number(e.target.value) || 1 }))
              }
              min={1}
              max={99}
              className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
            />
          </Field>
          <Field label={t("type")}>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((s) => ({ ...s, type: e.target.value as QuizQuestionType }))
              }
              className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
            >
              {QUIZ_QUESTION_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(`types.${k}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.required}
              onChange={(e) =>
                setForm((s) => ({ ...s, required: e.target.checked }))
              }
              className="h-4 w-4"
            />
            {t("required")}
          </label>
        </div>

        <fieldset className="mt-4 rounded-xl border border-ink-100 bg-grass-50/30 p-3">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-grass-800">
            {t("question_text")}
          </legend>
          {(["pl", "en", "ru"] as const).map((lang) => (
            <Field key={lang} label={t(`lang.${lang}`)}>
              <textarea
                value={form.question[lang]}
                onChange={(e) => setQ(lang, e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
              />
            </Field>
          ))}
        </fieldset>

        {(form.type === "single_choice" || form.type === "multi_choice") && (
          <fieldset className="mt-4 rounded-xl border border-ink-100 p-3">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-700">
              {t("choices")}
            </legend>
            <div className="space-y-3">
              {form.options_choices.map((c, i) => (
                <div key={i} className="rounded-lg border border-ink-100 bg-white p-3">
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr_100px_36px]">
                    <input
                      value={c.value}
                      onChange={(e) => setChoice(i, { value: e.target.value })}
                      placeholder="value"
                      className="h-9 rounded-md border border-ink-200 px-2 text-sm font-mono"
                    />
                    <div className="grid gap-1.5 sm:grid-cols-3">
                      {(["pl", "en", "ru"] as const).map((lang) => (
                        <input
                          key={lang}
                          value={c.label[lang]}
                          onChange={(e) =>
                            setChoice(i, {
                              label: { ...c.label, [lang]: e.target.value },
                            })
                          }
                          placeholder={lang.toUpperCase()}
                          className="h-9 rounded-md border border-ink-200 px-2 text-sm"
                        />
                      ))}
                    </div>
                    <input
                      type="number"
                      value={c.weight}
                      onChange={(e) =>
                        setChoice(i, { weight: Number(e.target.value) || 0 })
                      }
                      placeholder="weight"
                      className="h-9 rounded-md border border-ink-200 px-2 text-sm font-mono"
                    />
                    <button
                      onClick={() => removeChoice(i)}
                      disabled={form.options_choices.length <= 2}
                      className="grid h-9 place-items-center rounded-md text-clay-700 hover:bg-clay-50 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={addChoice}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink-300 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
              >
                <Plus className="h-3.5 w-3.5" /> {t("add_choice")}
              </button>
            </div>
          </fieldset>
        )}

        {form.type === "scale" && (
          <fieldset className="mt-4 rounded-xl border border-ink-100 p-3">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-700">
              {t("scale")}
            </legend>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={t("scale_min")}>
                <input
                  type="number"
                  value={form.options_scale.min}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      options_scale: { ...s.options_scale, min: Number(e.target.value) || 0 },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
                />
              </Field>
              <Field label={t("scale_max")}>
                <input
                  type="number"
                  value={form.options_scale.max}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      options_scale: { ...s.options_scale, max: Number(e.target.value) || 0 },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
                />
              </Field>
              <Field label={t("scale_center")}>
                <input
                  type="number"
                  value={form.formula_scale.center}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      formula_scale: { ...s.formula_scale, center: Number(e.target.value) || 0 },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
                />
              </Field>
              <Field label={t("scale_coef")}>
                <input
                  type="number"
                  value={form.formula_scale.coef}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      formula_scale: { ...s.formula_scale, coef: Number(e.target.value) || 0 },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-ink-500">{t("scale_hint")}</p>
          </fieldset>
        )}

        {form.type === "number" && (
          <fieldset className="mt-4 rounded-xl border border-ink-100 p-3">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-700">
              {t("number_formula")}
            </legend>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={t("number_kind")}>
                <select
                  value={form.formula_number.kind}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      formula_number: {
                        ...s.formula_number,
                        kind: e.target.value as "linear" | "step_per",
                      },
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
                >
                  <option value="linear">{t("number_kind_linear")}</option>
                  <option value="step_per">{t("number_kind_step")}</option>
                </select>
              </Field>
              <Field label={t("number_coef")}>
                <input
                  type="number"
                  value={form.formula_number.coef ?? ""}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      formula_number: {
                        ...s.formula_number,
                        coef: e.target.value === "" ? undefined : Number(e.target.value),
                      },
                    }))
                  }
                  placeholder="25"
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
                />
              </Field>
              <Field label={t("number_coef_field")}>
                <input
                  value={form.formula_number.coef_field ?? ""}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      formula_number: {
                        ...s.formula_number,
                        coef_field: e.target.value || undefined,
                      },
                    }))
                  }
                  placeholder="start_elo.experience_per_year"
                  className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm font-mono"
                />
              </Field>
              {form.formula_number.kind === "step_per" && (
                <Field label={t("number_step")}>
                  <input
                    type="number"
                    value={form.formula_number.step ?? 1}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        formula_number: {
                          ...s.formula_number,
                          step: Number(e.target.value) || 1,
                        },
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
                  />
                </Field>
              )}
            </div>
            <p className="mt-2 text-xs text-ink-500">{t("number_hint")}</p>
          </fieldset>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="h-10 rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-clay-500 px-4 text-sm font-medium text-white shadow-card hover:bg-clay-600 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-700">{label}</span>
      {children}
    </label>
  );
}
