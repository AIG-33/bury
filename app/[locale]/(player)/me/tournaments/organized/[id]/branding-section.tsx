"use client";

import { BrandingEditor } from "@/components/domain/branding-editor";
import { updateTournamentBranding } from "../branding-actions";
import type { TournamentBranding } from "@/lib/validators/tournament-branding";

// Thin wrapper: the actual editor is shared with clubs
// (components/domain/branding-editor.tsx) — same blob, same vocabulary.
export function TournamentBrandingSection({
  tournamentId,
  publicHref,
  initial,
}: {
  tournamentId: string;
  publicHref: string;
  initial: TournamentBranding;
}) {
  return (
    <BrandingEditor
      entityId={tournamentId}
      bucket="tournament-branding"
      namespace="tournamentsOrganized.branding"
      helpPageId="me-tournament-branding"
      publicHref={publicHref}
      initial={initial}
      onSave={(branding) => updateTournamentBranding({ tournament_id: tournamentId, branding })}
    />
  );
}
