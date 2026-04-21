"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, X, Sparkles } from "lucide-react";

export type TourStep = {
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

type Props = {
  storageKey: string;
  steps: TourStep[];
  closeLabel: string;
  nextLabel: string;
  backLabel: string;
  doneLabel: string;
  stepLabel: string; // e.g. "Step {current} of {total}"
};

/**
 * Lightweight, dependency-free in-page tour. Persists "dismissed" in localStorage
 * so it shows only once per browser. Designed to live at the top of a dashboard.
 */
export function OnboardingTour({
  storageKey,
  steps,
  closeLabel,
  nextLabel,
  backLabel,
  doneLabel,
  stepLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(storageKey);
    if (!dismissed) setOpen(true);
  }, [storageKey]);

  if (!open || steps.length === 0) return null;

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    }
    setOpen(false);
  }

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  return (
    <div className="relative overflow-hidden rounded-xl2 border border-leaf-200 bg-gradient-to-r from-leaf-50 via-white to-amber-50 p-5 shadow-card">
      <button
        type="button"
        onClick={dismiss}
        aria-label={closeLabel}
        className="absolute right-3 top-3 rounded-full p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-leaf-100 text-leaf-700">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-leaf-700">
            {stepLabel.replace("{current}", String(step + 1)).replace("{total}", String(steps.length))}
          </p>
          <h3 className="mt-0.5 font-display text-lg font-semibold text-ink-900">
            {current.title}
          </h3>
          <p className="mt-1 text-sm text-ink-600">{current.body}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {current.cta && (
              <a
                href={current.cta.href}
                className="inline-flex items-center gap-1 rounded-full bg-leaf-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-leaf-800"
              >
                {current.cta.label}
                <ChevronRight className="h-3 w-3" />
              </a>
            )}
            <div className="ml-auto flex items-center gap-1">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-300"
                >
                  <ChevronLeft className="h-3 w-3" />
                  {backLabel}
                </button>
              )}
              {isLast ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex items-center gap-1 rounded-full border border-leaf-300 bg-leaf-100 px-3 py-1.5 text-xs font-semibold text-leaf-800 transition hover:bg-leaf-200"
                >
                  {doneLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-300"
                >
                  {nextLabel}
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Progress dots */}
          <div className="mt-3 flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition ${
                  i === step ? "bg-leaf-700" : i < step ? "bg-leaf-300" : "bg-ink-100"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
