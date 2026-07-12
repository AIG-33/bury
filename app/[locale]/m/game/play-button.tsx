"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { Check } from "lucide-react";
import { applyToOpenMatch } from "@/app/[locale]/open-matches/actions";

// =============================================================================
// «Играть» button (ТЗ Mobile §7.07): gradient, radius 11, 12.5px/800.
// Applies to the open match in one tap; guests are sent to /login.
// =============================================================================

type Props = {
  openMatchId: string;
  authenticated: boolean;
  alreadyApplied: boolean;
  labels: { play: string; applied: string; error: string };
};

export function PlayButton({ openMatchId, authenticated, alreadyApplied, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(alreadyApplied);
  const [error, setError] = useState(false);

  if (done) {
    return (
      <span className="inline-flex h-9 items-center gap-1 rounded-[11px] bg-[rgba(28,122,70,0.1)] px-3 font-display text-[12px] font-extrabold text-grass-600">
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
        {labels.applied}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        className="inline-flex h-9 items-center rounded-[11px] bg-pt-primary px-4 font-display text-[12.5px] font-extrabold text-white shadow-[0_6px_14px_rgba(28,122,70,0.3)] transition-opacity active:opacity-85 disabled:opacity-60"
        onClick={() => {
          if (!authenticated) {
            router.push("/login" as never);
            return;
          }
          startTransition(async () => {
            setError(false);
            const res = await applyToOpenMatch({ open_match_id: openMatchId });
            if (res.ok) setDone(true);
            else setError(true);
          });
        }}
      >
        {labels.play}
      </button>
      {error ? (
        <span className="mt-1 text-[10px] font-bold text-clay-500">{labels.error}</span>
      ) : null}
    </span>
  );
}
