import { Globe2, Lock, ShieldCheck } from "lucide-react";
import type { JoinPolicy } from "@/lib/clubs/schema";

type Props = {
  policy: JoinPolicy;
  labels: Record<JoinPolicy, string>;
  /** When true, only the icon is shown — used inside dense catalogue rows. */
  iconOnly?: boolean;
};

const CONFIG: Record<JoinPolicy, { icon: typeof Globe2; tone: string }> = {
  approval: { icon: ShieldCheck, tone: "bg-ball-50 text-ball-800 border-ball-200" },
  open:     { icon: Globe2,      tone: "bg-grass-50 text-grass-800 border-grass-200" },
  closed:   { icon: Lock,        tone: "bg-clay-50 text-clay-800 border-clay-200" },
};

/**
 * Visual marker for a club's `join_policy`. The three values use distinct
 * colours so a roster of clubs can be scanned at a glance:
 *   approval → ball (yellow, friendly "needs review")
 *   open     → grass (green, "anyone walks in")
 *   closed   → clay  (red,   "invite only")
 */
export function JoinPolicyBadge({ policy, labels, iconOnly = false }: Props) {
  const { icon: Icon, tone } = CONFIG[policy];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
      title={labels[policy]}
    >
      <Icon className="h-3 w-3" />
      {!iconOnly && <span>{labels[policy]}</span>}
    </span>
  );
}
