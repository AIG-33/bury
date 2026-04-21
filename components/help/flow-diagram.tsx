import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  label: string;
  description?: string;
};

type FlowDiagramProps = {
  steps: Step[];
  currentStep: number;
  variant?: "horizontal" | "vertical";
};

export function FlowDiagram({
  steps,
  currentStep,
  variant = "horizontal",
}: FlowDiagramProps) {
  if (variant === "vertical") {
    return (
      <ol className="space-y-3">
        {steps.map((step, idx) => {
          const state = stateOf(idx, currentStep);
          return (
            <li key={step.id} className="flex gap-3">
              <StepDot index={idx} state={state} />
              <div>
                <p className={cn("text-sm font-medium", labelClass(state))}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-ink-500">{step.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((step, idx) => {
        const state = stateOf(idx, currentStep);
        const isLast = idx === steps.length - 1;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
                state === "current"
                  ? "bg-grass-500 text-white"
                  : state === "done"
                    ? "bg-grass-100 text-grass-800"
                    : "bg-ink-100 text-ink-500",
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                  state === "current"
                    ? "bg-white text-grass-700"
                    : state === "done"
                      ? "bg-grass-500 text-white"
                      : "bg-white text-ink-500",
                )}
              >
                {state === "done" ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              {step.label}
            </span>
            {!isLast && (
              <span aria-hidden className="h-px w-4 border-t border-dashed border-ink-200" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function stateOf(idx: number, current: number): "done" | "current" | "future" {
  if (idx < current) return "done";
  if (idx === current) return "current";
  return "future";
}

function labelClass(state: "done" | "current" | "future") {
  if (state === "current") return "text-grass-700";
  if (state === "done") return "text-grass-800";
  return "text-ink-500";
}

function StepDot({
  index,
  state,
}: {
  index: number;
  state: "done" | "current" | "future";
}) {
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        state === "current"
          ? "bg-grass-500 text-white"
          : state === "done"
            ? "bg-grass-100 text-grass-700"
            : "bg-ink-100 text-ink-500",
      )}
    >
      {state === "done" ? <Check className="h-3 w-3" /> : index + 1}
    </span>
  );
}
