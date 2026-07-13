"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { ChevronRight, Check, Clock3 } from "lucide-react";
import {
  applyToTournament,
  withdrawFromTournament,
} from "@/app/[locale]/(player)/me/tournaments/actions";

// =============================================================================
// CTA button for the tournament detail screen (ТЗ Mobile §7.03).
// The state machine mirrors the web apply button: none → pending → approved,
// with withdraw available while registration is open. Destructive withdraw
// goes through an inline confirm step (AGENTS §3.8).
// =============================================================================

type Props = {
  tournamentId: string;
  state: "guest" | "none" | "pending" | "approved" | "closed" | "owner";
  /** Branding accent (#RRGGBB, pre-sanitized) — overrides the primary button color. */
  accentColor?: string | null;
  labels: {
    apply: string;
    login: string;
    pending: string;
    approved: string;
    closed: string;
    owner: string;
    withdraw: string;
    withdraw_confirm: string;
    cancel: string;
    error: string;
  };
};

const PRIMARY =
  "flex h-12 w-full items-center justify-center gap-1.5 rounded-[15px] bg-pt-primary font-display text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(28,122,70,0.32)] transition-opacity active:opacity-85 disabled:opacity-60";
const NEUTRAL =
  "flex h-12 w-full items-center justify-center gap-1.5 rounded-[15px] border border-[rgba(20,60,30,0.12)] bg-white font-display text-[14px] font-extrabold text-ink-500";

export function TournamentApplyCta({ tournamentId, state, accentColor, labels }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const accentStyle = accentColor
    ? { background: accentColor, boxShadow: "0 10px 22px rgba(0,0,0,0.18)" }
    : undefined;

  if (state === "guest") {
    return (
      <button
        type="button"
        className={PRIMARY}
        style={accentStyle}
        onClick={() => router.push("/login" as never)}
      >
        {labels.login}
        <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
      </button>
    );
  }

  if (state === "closed" || state === "owner") {
    return <div className={NEUTRAL}>{state === "owner" ? labels.owner : labels.closed}</div>;
  }

  if (state === "none") {
    return (
      <div>
        <button
          type="button"
          disabled={pending}
          className={PRIMARY}
          style={accentStyle}
          onClick={() =>
            startTransition(async () => {
              setError(false);
              const res = await applyToTournament(tournamentId);
              if (res.ok) router.refresh();
              else setError(true);
            })
          }
        >
          {labels.apply}
          <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
        </button>
        {error ? (
          <p className="mt-1.5 text-center text-[11.5px] font-bold text-clay-500">{labels.error}</p>
        ) : null}
      </div>
    );
  }

  // pending / approved → status + withdraw with confirm.
  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          className="flex h-12 flex-1 items-center justify-center rounded-[15px] border border-[rgba(20,60,30,0.12)] bg-white font-display text-[13.5px] font-extrabold text-ink-700 transition-opacity active:opacity-85"
          onClick={() => setConfirming(false)}
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          disabled={pending}
          className="flex h-12 flex-1 items-center justify-center rounded-[15px] bg-clay-500 font-display text-[13.5px] font-extrabold text-white transition-opacity active:opacity-85 disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              const res = await withdrawFromTournament(tournamentId);
              if (res.ok) {
                setConfirming(false);
                router.refresh();
              } else setError(true);
            })
          }
        >
          {labels.withdraw_confirm}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[15px] font-display text-[14px] font-extrabold ${
          state === "approved"
            ? "bg-[rgba(28,122,70,0.1)] text-grass-600"
            : "bg-sun-50 text-sun-600"
        }`}
      >
        {state === "approved" ? (
          <Check className="h-4 w-4" strokeWidth={2.4} />
        ) : (
          <Clock3 className="h-4 w-4" strokeWidth={2.2} />
        )}
        {state === "approved" ? labels.approved : labels.pending}
      </div>
      <button
        type="button"
        className="h-12 shrink-0 rounded-[15px] border border-clay-200 bg-white px-4 font-display text-[12.5px] font-extrabold text-clay-500 transition-opacity active:opacity-85"
        onClick={() => setConfirming(true)}
      >
        {labels.withdraw}
      </button>
    </div>
  );
}
