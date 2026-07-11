import { Globe2, Lock, ShieldCheck } from "lucide-react";
import type { JoinPolicy } from "@/lib/clubs/schema";

type Props = {
  policy: JoinPolicy;
  labels: Record<JoinPolicy, string>;
  /** When true, only the icon is shown — used inside dense catalogue rows. */
  iconOnly?: boolean;
};

// Spec §2.2/§4.4: «По заявке» — warning yellow, «Открытый» — green,
// closed — danger red. Borderless pills.
const CONFIG: Record<JoinPolicy, { icon: typeof Globe2; tone: string }> = {
  approval: { icon: ShieldCheck, tone: "bg-sun-50 text-sun-600" },
  open:     { icon: Globe2,      tone: "bg-grass-600/10 text-grass-600" },
  closed:   { icon: Lock,        tone: "bg-clay-100 text-clay-500" },
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}
      title={labels[policy]}
    >
      <Icon className="h-3 w-3" />
      {!iconOnly && <span>{labels[policy]}</span>}
    </span>
  );
}
