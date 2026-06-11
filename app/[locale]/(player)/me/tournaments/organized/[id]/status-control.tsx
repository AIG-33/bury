"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileEdit, Loader2, Megaphone, Undo2 } from "lucide-react";
import { setTournamentStatus } from "../actions";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import type { TournamentStatus } from "@/lib/tournaments/schema";

export type StatusControlCopy = {
  draft_title: string;
  draft_body: string;
  open_registration: string;
  opening: string;
  registration_title: string;
  registration_body: string;
  revert_to_draft: string;
  reverting: string;
  revert_confirm: string;
};

/**
 * Draft ↔ registration switch. Only rendered while the tournament hasn't
 * started — once the draw is generated the status is owned by the
 * bracket/score flow.
 */
export function StatusControl({
  tournamentId,
  status,
  copy,
}: {
  tournamentId: string;
  status: TournamentStatus;
  copy: StatusControlCopy;
}) {
  const router = useRouter();
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const [pending, startT] = useTransition();

  if (status !== "draft" && status !== "registration") return null;

  function flip(next: TournamentStatus) {
    startT(async () => {
      const r = await setTournamentStatus(tournamentId, next);
      if (!r.ok) {
        alert(localizeActionError(tErrors, r.error));
        return;
      }
      router.refresh();
    });
  }

  if (status === "draft") {
    return (
      <section className="rounded-xl2 border border-ink-200 bg-ink-50/60 p-4 shadow-card">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-700">
            <FileEdit className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-display text-sm font-semibold text-ink-900">
              {copy.draft_title}
            </p>
            <p className="text-xs text-ink-700">{copy.draft_body}</p>
          </div>
          <button
            type="button"
            onClick={() => flip("registration")}
            disabled={pending}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-grass-700 px-4 text-[12px] font-semibold uppercase tracking-wider text-white shadow-[0_8px_20px_-10px_rgba(21,94,54,0.5)] transition hover:-translate-y-0.5 hover:bg-grass-800 disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {copy.opening}
              </>
            ) : (
              <>
                <Megaphone className="h-3.5 w-3.5" />
                {copy.open_registration}
              </>
            )}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl2 border border-ball-200 bg-ball-50/60 p-4 shadow-card">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ball-100 text-ball-800">
          <Megaphone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-sm font-semibold text-ball-900">
            {copy.registration_title}
          </p>
          <p className="text-xs text-ball-800">{copy.registration_body}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!confirm(copy.revert_confirm)) return;
            flip("draft");
          }}
          disabled={pending}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {copy.reverting}
            </>
          ) : (
            <>
              <Undo2 className="h-3.5 w-3.5" />
              {copy.revert_to_draft}
            </>
          )}
        </button>
      </div>
    </section>
  );
}
