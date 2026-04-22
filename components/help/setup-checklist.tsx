import Link from "next/link";
import { Check, ChevronRight, Circle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type SetupChecklistStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  /**
   * - "done" / "current" / "future": active step in the coach's flow
   * - "info": passive context the coach doesn't control (e.g. directory
   *   counts maintained by an admin). Shown without a CTA.
   */
  state: "done" | "current" | "future" | "info";
  count?: number;
  countLabel?: string;
  ctaLabel: string;
};

type Props = {
  title: string;
  subtitle?: string;
  steps: SetupChecklistStep[];
  completed: number;
  total: number;
  progressLabel: string;
  doneLabel: string;
  completedBadge?: string;
};

/**
 * Vertical step-by-step checklist that always tells the coach
 *   1) where they are in the canonical setup flow,
 *   2) what the next concrete action is, and
 *   3) what's already done.
 *
 * Renders a single "primary" CTA on the current step (so the coach never has
 * to guess the order). Future steps are visible but greyed out — they explain
 * the journey ahead without distracting from the current task.
 */
export function SetupChecklist({
  title,
  subtitle,
  steps,
  completed,
  total,
  progressLabel,
  doneLabel,
  completedBadge,
}: Props) {
  const progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = completed === total;

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card sm:p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="text-sm text-ink-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm tabular-nums text-ink-700">
            {completed}/{total}
          </span>
          <div
            className="h-2 w-32 overflow-hidden rounded-full bg-ink-100"
            role="progressbar"
            aria-label={progressLabel}
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allDone ? "bg-grass-500" : "bg-leaf-500",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {allDone && completedBadge && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-grass-100 px-3 py-1 text-xs font-medium text-grass-800">
          <Check className="h-3.5 w-3.5" />
          {completedBadge}
        </p>
      )}

      <ol className="space-y-3">
        {steps.map((step, idx) => (
          <Item key={step.id} step={step} index={idx} doneLabel={doneLabel} />
        ))}
      </ol>
    </section>
  );
}

function Item({
  step,
  index,
  doneLabel,
}: {
  step: SetupChecklistStep;
  index: number;
  doneLabel: string;
}) {
  const isCurrent = step.state === "current";
  const isDone = step.state === "done";
  const isInfo = step.state === "info";

  return (
    <li
      className={cn(
        "relative flex gap-4 rounded-xl border p-4 transition",
        isCurrent && "border-leaf-300 bg-leaf-50/60",
        isDone && "border-grass-100 bg-grass-50/40",
        isInfo && "border-dashed border-ink-200 bg-ink-50/40",
        step.state === "future" && "border-ink-100 bg-white",
      )}
    >
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            isDone && "bg-grass-500 text-white",
            isCurrent && "bg-leaf-600 ring-leaf-100 text-white ring-4",
            isInfo && "bg-ink-200 text-ink-600",
            step.state === "future" && "bg-ink-100 text-ink-500",
          )}
        >
          {isDone ? (
            <Check className="h-4 w-4" />
          ) : isInfo ? (
            <Info className="h-4 w-4" />
          ) : (
            index + 1
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3
            className={cn(
              "font-medium",
              isCurrent && "text-leaf-900",
              isDone && "text-grass-800",
              isInfo && "text-ink-700",
              step.state === "future" && "text-ink-700",
            )}
          >
            {step.title}
          </h3>
          {typeof step.count === "number" && step.count >= 0 && step.countLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                isInfo ? "bg-white text-ink-700 ring-1 ring-ink-200" : "bg-ink-50 text-ink-600",
              )}
            >
              <Circle className="h-2 w-2 fill-current" />
              {step.count} {step.countLabel}
            </span>
          )}
        </div>
        <p
          className={cn(
            "mt-1 text-sm",
            step.state === "future" || isInfo ? "text-ink-500" : "text-ink-600",
          )}
        >
          {step.description}
        </p>
        <div className="mt-3">
          {isCurrent ? (
            <Link
              href={step.href}
              className="bg-leaf-700 hover:bg-leaf-800 inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold text-white transition"
            >
              {step.ctaLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : isDone ? (
            <Link
              href={step.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-grass-700 hover:underline"
            >
              {doneLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : isInfo ? (
            <Link
              href={step.href}
              className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
            >
              {step.ctaLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <Link
              href={step.href}
              className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
            >
              {step.ctaLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
