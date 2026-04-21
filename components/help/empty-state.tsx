import type { ReactNode } from "react";
import Link from "next/link";
import { TennisBall } from "@/components/icons/tennis-ball";

type EmptyStateProps = {
  illustration?: "ball";
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  action?: ReactNode;
};

export function EmptyState({
  illustration = "ball",
  title,
  description,
  ctaLabel,
  ctaHref,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
      {illustration === "ball" && (
        <TennisBall className="h-16 w-16 text-ball-500 opacity-80" />
      )}
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
        <p className="max-w-md text-sm text-ink-600">{description}</p>
      </div>
      {action ??
        (ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="inline-flex h-10 items-center rounded-lg bg-grass-500 px-4 text-sm font-medium text-white transition hover:bg-grass-600"
          >
            {ctaLabel}
          </Link>
        ))}
    </div>
  );
}
