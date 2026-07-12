import { cn } from "@/lib/utils";
import type { TournamentStatus } from "@/lib/tournaments/schema";

/**
 * Tournament status pill (redesign spec §2.2). Status colour is the only
 * semantic code: green = accepting entries, yellow = waiting, lime = live,
 * grey = finished. Registration and in-progress get a pulsing dot.
 */
export function TournamentStatusPill({
  status,
  label,
  className,
}: {
  status: TournamentStatus;
  label: string;
  className?: string;
}) {
  const tone =
    status === "registration"
      ? "bg-grass-600/10 text-grass-600"
      : status === "in_progress"
        ? "bg-ball-100 text-ball-700"
        : status === "draft"
          ? "bg-sun-50 text-sun-600"
          : status === "cancelled"
            ? "bg-clay-100 text-clay-500"
            : "bg-ink-50 text-[#7A8C7F]";
  const pulse = status === "registration" || status === "in_progress";

  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-bold",
        tone,
        className,
      )}
    >
      {pulse && <span className="pulse-dot" />}
      {label}
    </span>
  );
}
