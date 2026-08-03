"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Medal } from "lucide-react";
import { setThirdPlaceMatch } from "../actions";
import { localizeActionError } from "@/lib/tournaments/action-errors";

export type ThirdPlaceControlCopy = {
  title: string;
  status_on: string;
  status_off: string;
  hint_on_created: string;
  hint_on_no_bracket: string;
  hint_off: string;
  enable: string;
  disable: string;
  saving: string;
  disable_confirm_created: string;
  played_note: string;
};

/**
 * Mid-tournament toggle for the 3rd-place match of a hybrid tournament.
 * The create/edit form is locked once the tournament runs; this control
 * calls `setThirdPlaceMatch`, which creates/deletes the bronze match in the
 * already-seeded playoff (see the action for the edge cases).
 */
export function ThirdPlaceControl({
  tournamentId,
  enabled,
  matchExists,
  matchPlayed,
  copy,
}: {
  tournamentId: string;
  enabled: boolean;
  /** A stage='third_place' row exists in the bracket. */
  matchExists: boolean;
  /** That row already has a recorded result — disabling is blocked. */
  matchPlayed: boolean;
  copy: ThirdPlaceControlCopy;
}) {
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const router = useRouter();
  const [pending, startT] = useTransition();

  function toggle() {
    const next = !enabled;
    if (!next && matchExists && !confirm(copy.disable_confirm_created)) return;
    startT(async () => {
      const r = await setThirdPlaceMatch({ tournament_id: tournamentId, enabled: next });
      if (r.ok) router.refresh();
      else alert(localizeActionError(tErrors, r.error));
    });
  }

  const hint = enabled
    ? matchExists
      ? copy.hint_on_created
      : copy.hint_on_no_bracket
    : copy.hint_off;
  const disableBlocked = enabled && matchPlayed;

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-clay-600" />
          <h2 className="font-display text-lg font-semibold text-ink-900">{copy.title}</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              enabled ? "bg-grass-100 text-grass-800" : "bg-ink-100 text-ink-600"
            }`}
          >
            {enabled ? copy.status_on : copy.status_off}
          </span>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending || disableBlocked}
          className={`inline-flex h-8 items-center gap-1 rounded-[11px] px-3 text-xs font-semibold transition hover:-translate-y-0.5 disabled:opacity-60 ${
            enabled
              ? "border border-clay-300 bg-white text-clay-700 hover:bg-clay-50"
              : "bg-pt-primary text-white"
          }`}
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          {pending ? copy.saving : enabled ? copy.disable : copy.enable}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-600">{hint}</p>
      {disableBlocked && (
        <p className="mt-2 rounded-lg bg-ball-50 px-3 py-2 text-xs text-ball-900">
          {copy.played_note}
        </p>
      )}
    </section>
  );
}
