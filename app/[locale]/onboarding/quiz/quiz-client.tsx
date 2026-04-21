"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Trophy } from "lucide-react";
import { FlowDiagram } from "@/components/help/flow-diagram";
import { submitQuiz } from "./actions";
import type { QuizQuestionRow } from "@/lib/supabase/types";

type Locale = "pl" | "en" | "ru";

type Copy = {
  next: string;
  prev: string;
  submit: string;
  step: string;
  required: string;
  done_title: string;
  done_body: string;
  done_cta: string;
  submitting: string;
  error: string;
  choose: string;
};

type Props = {
  locale: Locale;
  versionId: string;
  questions: QuizQuestionRow[];
  copy: Copy;
};

export function QuizClient({ locale, versionId, questions, copy }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<{ elo: number } | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const total = questions.length;
  const current = questions[step];
  const isLast = step === total - 1;

  function setAnswer(value: string | number | string[]) {
    setAnswers((prev) => ({ ...prev, [current.code]: value }));
  }

  function next() {
    setErrMsg(null);
    if (current.required && (answers[current.code] === undefined || answers[current.code] === "")) {
      setErrMsg(copy.required);
      return;
    }
    if (step < total - 1) setStep(step + 1);
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function submit() {
    if (current.required && (answers[current.code] === undefined || answers[current.code] === "")) {
      setErrMsg(copy.required);
      return;
    }
    setErrMsg(null);
    startTransition(async () => {
      const result = await submitQuiz({ versionId, answers });
      if (result.ok) {
        setDone({ elo: result.elo });
      } else {
        setErrMsg(`${copy.error}: ${result.error}`);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-xl2 border border-grass-100 bg-grass-50 p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-grass-600" />
        <h2 className="font-display text-2xl font-bold text-ink-900">{copy.done_title}</h2>
        <p className="mt-2 inline-flex items-center gap-2 font-mono text-5xl font-bold text-grass-700 tabular-nums">
          <Trophy className="h-9 w-9 text-ball-500" /> {done.elo}
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-700">{copy.done_body}</p>
        <button
          type="button"
          onClick={() => router.push("/me/profile")}
          className="mt-5 inline-flex h-11 items-center rounded-lg bg-grass-500 px-6 text-sm font-medium text-white shadow-card transition hover:bg-grass-600"
        >
          {copy.done_cta}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FlowDiagram
        currentStep={step}
        steps={questions.map((q, i) => ({
          id: q.code,
          label: `${i + 1}`,
        }))}
      />

      <div className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
          {copy.step} {step + 1} / {total}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink-900">
          {(current.question as Record<string, string>)[locale] ?? current.code}
        </h2>

        <div className="mt-4">
          <QuestionInput
            question={current}
            locale={locale}
            value={answers[current.code]}
            onChange={setAnswer}
            placeholder={copy.choose}
          />
        </div>

        {errMsg && (
          <p className="mt-3 rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-700 animate-letCordShake">
            {errMsg}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0 || isPending}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> {copy.prev}
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-5 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {copy.submitting}
                </>
              ) : (
                <>{copy.submit}</>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={isPending}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-grass-500 px-5 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-60"
            >
              {copy.next} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  locale,
  value,
  onChange,
  placeholder,
}: {
  question: QuizQuestionRow;
  locale: Locale;
  value: string | number | string[] | undefined;
  onChange: (v: string | number | string[]) => void;
  placeholder: string;
}) {
  switch (question.type) {
    case "single_choice": {
      const opts = (question.options ?? []) as Array<{
        value: string;
        label: Record<string, string>;
      }>;
      return (
        <div className="space-y-2">
          {opts.map((o) => {
            const selected = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className={`block w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                  selected
                    ? "border-grass-500 bg-grass-50 text-grass-800"
                    : "border-ink-200 bg-white text-ink-700 hover:border-grass-300"
                }`}
              >
                {o.label[locale] ?? o.value}
              </button>
            );
          })}
        </div>
      );
    }

    case "multi_choice": {
      const opts = (question.options ?? []) as Array<{
        value: string;
        label: Record<string, string>;
      }>;
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {opts.map((o) => {
            const selected = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  onChange(selected ? arr.filter((x) => x !== o.value) : [...arr, o.value])
                }
                className={`block w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                  selected
                    ? "border-grass-500 bg-grass-50 text-grass-800"
                    : "border-ink-200 bg-white text-ink-700 hover:border-grass-300"
                }`}
              >
                {o.label[locale] ?? o.value}
              </button>
            );
          })}
        </div>
      );
    }

    case "scale": {
      const opts = (question.options ?? { min: 1, max: 10 }) as { min: number; max: number };
      const num = typeof value === "number" ? value : opts.min;
      return (
        <div className="space-y-2">
          <input
            type="range"
            min={opts.min}
            max={opts.max}
            step={1}
            value={num}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-grass-500"
          />
          <div className="flex justify-between text-xs text-ink-500">
            <span>{opts.min}</span>
            <span className="font-mono text-base font-bold text-grass-700">{num}</span>
            <span>{opts.max}</span>
          </div>
        </div>
      );
    }

    case "number": {
      const num = typeof value === "number" ? value : "";
      return (
        <input
          type="number"
          min={0}
          step={1}
          value={num}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none transition focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
        />
      );
    }

    default:
      return null;
  }
}
