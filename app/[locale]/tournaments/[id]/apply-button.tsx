"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Clock, Loader2, LogIn, UserPlus } from "lucide-react";
import {
  applyToTournament,
  type TournamentViewerState,
} from "@/app/[locale]/(player)/me/tournaments/actions";
import { TournamentPartnerPicker } from "@/components/domain/tournament-partner-picker";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import type { TournamentStatus, TournamentDiscipline } from "@/lib/tournaments/schema";

export type ApplyButtonCopy = {
  title: string;
  cta: string;
  applying: string;
  login_cta: string;
  login_hint: string;
  closed: string;
  owner: string;
  pending: string;
  approved: string;
  rejected: string;
};

export function TournamentApplyButton({
  locale,
  tournamentId,
  status,
  discipline = "singles",
  viewer,
  copy,
}: {
  locale: string;
  tournamentId: string;
  status: TournamentStatus;
  discipline?: TournamentDiscipline;
  viewer: TournamentViewerState;
  copy: ApplyButtonCopy;
}) {
  const router = useRouter();
  const tErrors = useTranslations("tournamentsPlayer.errors");
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Anonymous visitor — route through login, then bounce back to this page.
  if (!viewer.authenticated) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/${locale}/login?next=/tournaments/${tournamentId}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-[13px] bg-pt-primary px-4 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5"
        >
          <LogIn className="h-4 w-4" />
          {copy.login_cta}
        </a>
        <span className="text-xs text-ink-500">{copy.login_hint}</span>
      </div>
    );
  }

  if (viewer.isOwner) {
    return (
      <span className="inline-flex h-10 items-center rounded-lg border border-ink-100 bg-ink-50 px-4 text-sm font-medium text-ink-600">
        {copy.owner}
      </span>
    );
  }

  if (viewer.applicationStatus === "approved") {
    return (
      <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-grass-200 bg-grass-50 px-4 text-sm font-medium text-grass-800">
        <Check className="h-4 w-4" />
        {copy.approved}
      </span>
    );
  }

  if (viewer.applicationStatus === "pending") {
    return (
      <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-ball-200 bg-ball-50 px-4 text-sm font-medium text-ball-800">
        <Clock className="h-4 w-4" />
        {copy.pending}
      </span>
    );
  }

  // Registration must be open for anyone (rejected included) to (re)apply.
  if (status !== "registration") {
    return (
      <span className="inline-flex h-10 items-center rounded-lg border border-ink-100 bg-ink-50 px-4 text-sm font-medium text-ink-500">
        {copy.closed}
      </span>
    );
  }

  function submit(partnerId?: string) {
    setError(null);
    startT(async () => {
      const r = await applyToTournament(tournamentId, { partnerId: partnerId ?? null });
      if (r.ok) {
        setPickerOpen(false);
        router.refresh();
      } else setError(localizeActionError(tErrors, r.error));
    });
  }

  function onApply() {
    // Doubles tournaments register a PAIR — pick the partner first.
    if (discipline === "doubles") {
      setError(null);
      setPickerOpen(true);
      return;
    }
    submit();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {viewer.applicationStatus === "rejected" && (
        <span className="text-xs text-clay-700">{copy.rejected}</span>
      )}
      <button
        type="button"
        onClick={onApply}
        disabled={pending}
        className="inline-flex h-10 items-center gap-1.5 rounded-[13px] bg-pt-primary px-4 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {pending ? copy.applying : copy.cta}
      </button>
      {error && <span className="text-xs text-clay-700">{error}</span>}
      <TournamentPartnerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(partnerId) => submit(partnerId)}
        submitting={pending}
      />
    </div>
  );
}
