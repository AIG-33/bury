// =============================================================================
// Pure participant validation for match registration (singles + doubles).
// Kept out of the Server Action file so it's unit-testable without Supabase.
// =============================================================================

export type MatchParticipantsInput = {
  /** The reporting player (side 1 captain). */
  reporterId: string;
  opponentId: string;
  isDoubles: boolean;
  myPartnerId?: string | null;
  opponentPartnerId?: string | null;
};

export type MatchParticipantsResult =
  | {
      ok: true;
      /** [p1, p1_partner?, p2, p2_partner?] — partner slots null for singles. */
      p1_id: string;
      p1_partner_id: string | null;
      p2_id: string;
      p2_partner_id: string | null;
      /** All distinct participant ids (2 or 4). */
      allIds: string[];
    }
  | {
      ok: false;
      error: "self_match" | "missing_partner" | "duplicate_player";
    };

/**
 * Validate the participant set of a friendly match.
 *   – Singles: reporter vs opponent, must be different people.
 *   – Doubles: four players, all pairwise distinct, both partners required.
 */
export function validateMatchParticipants(
  input: MatchParticipantsInput,
): MatchParticipantsResult {
  if (!input.isDoubles) {
    if (input.reporterId === input.opponentId) {
      return { ok: false, error: "self_match" };
    }
    return {
      ok: true,
      p1_id: input.reporterId,
      p1_partner_id: null,
      p2_id: input.opponentId,
      p2_partner_id: null,
      allIds: [input.reporterId, input.opponentId],
    };
  }

  const myPartner = input.myPartnerId ?? null;
  const oppPartner = input.opponentPartnerId ?? null;
  if (!myPartner || !oppPartner) {
    return { ok: false, error: "missing_partner" };
  }

  const all = [input.reporterId, myPartner, input.opponentId, oppPartner];
  if (new Set(all).size !== 4) {
    // Any coincidence (self as opponent/partner, same partner on both sides…)
    return {
      ok: false,
      error: input.reporterId === input.opponentId ? "self_match" : "duplicate_player",
    };
  }

  return {
    ok: true,
    p1_id: input.reporterId,
    p1_partner_id: myPartner,
    p2_id: input.opponentId,
    p2_partner_id: oppPartner,
    allIds: all,
  };
}
