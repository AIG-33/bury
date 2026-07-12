import type { SVGProps } from "react";

// Scoreboard icon for the middle "Матчи" tab (ТЗ §5 «иконка-табло»).
// Same visual grammar as lucide: 24×24 viewBox, stroke currentColor,
// rounded caps, stroke ~1.8.
export function ScoreboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M12 8v8" strokeDasharray="1.5 2.5" />
      <path d="M7 10.5v3M17 10.5v3" />
    </svg>
  );
}

// Tennis ball (ТЗ §6 «мяч») — circle + two seam arcs.
export function TennisBallIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M4.5 6.5a9 9 0 0 1 0 11" />
      <path d="M19.5 6.5a9 9 0 0 0 0 11" />
    </svg>
  );
}
