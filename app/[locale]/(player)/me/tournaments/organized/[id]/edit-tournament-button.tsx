"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { TournamentFormDialog, type TournamentDialogCopy } from "../tournament-form-dialog";
import type { TournamentRow, VenueOption, ClubOption } from "../actions";
import type { MatchRules, TournamentForm } from "@/lib/tournaments/schema";

function tournamentToForm(t: TournamentRow): TournamentForm {
  return {
    name: t.name,
    description: t.description,
    format: t.format,
    discipline: t.discipline,
    surface: t.surface,
    starts_on: t.starts_on,
    start_time: t.start_time ? t.start_time.slice(0, 5) : null,
    ends_on: t.ends_on,
    registration_deadline: t.registration_deadline ? t.registration_deadline.slice(0, 10) : null,
    max_participants: t.max_participants,
    entry_fee_byn: t.entry_fee_byn,
    privacy: t.privacy,
    application_mode: t.application_mode,
    club_id: t.club_id ?? null,
    draw_method: t.draw_method ?? "rating",
    prizes_description: t.prizes_description,
    match_rules: t.match_rules as MatchRules,
    venue_ids: t.venues.map((v) => v.id),
    third_place_match: t.third_place_match,
    hide_organizer: t.hide_organizer,
    regulations_text: t.regulations_text,
    regulations_file_url: t.regulations_file_url,
  };
}

export function EditTournamentButton({
  tournament,
  venueOptions,
  clubOptions,
  dialogCopy,
  label,
  lockedHint,
}: {
  tournament: TournamentRow;
  venueOptions: VenueOption[];
  clubOptions: ClubOption[];
  dialogCopy: TournamentDialogCopy;
  label: string;
  /** Shown when the draw already exists — format/rules can no longer change. */
  lockedHint: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={lockedHint ?? undefined}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50"
      >
        <Pencil className="h-3.5 w-3.5" />
        {label}
      </button>

      <TournamentFormDialog
        open={open}
        onClose={() => setOpen(false)}
        initial={{ id: tournament.id, form: tournamentToForm(tournament) }}
        mode="edit"
        locked={tournament.status === "in_progress" || tournament.status === "finished"}
        venueOptions={venueOptions}
        clubOptions={clubOptions}
        copy={dialogCopy}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
