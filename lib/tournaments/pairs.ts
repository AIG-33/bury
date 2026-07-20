// =============================================================================
// Doubles (pair) tournament helpers.
//
// A pair is stored as ONE `tournament_participants` row:
//   player_id  — the captain (registered the pair / was picked first),
//   partner_id — the partner.
//
// The draw pipeline stays keyed by the captain's id; these helpers cover the
// bits that are pair-specific: registration validation (nobody may appear in
// two pairs), the seeding rating of a pair, and display-name composition.
// =============================================================================

export type PairSlotRow = {
  player_id: string;
  partner_id: string | null;
};

export type PairRegistrationError =
  | "partner_required"
  | "partner_is_self"
  | "already_registered"
  | "partner_already_registered";

/**
 * Validate a doubles registration against the existing participant rows of
 * the tournament. `existing` must contain every non-withdrawn row regardless
 * of status — a pending pair still reserves both players.
 */
export function validatePairRegistration(args: {
  captainId: string;
  partnerId: string | null | undefined;
  existing: PairSlotRow[];
}): { ok: true; partnerId: string } | { ok: false; error: PairRegistrationError } {
  const { captainId, existing } = args;
  const partnerId = args.partnerId ?? null;
  if (!partnerId) return { ok: false, error: "partner_required" };
  if (partnerId === captainId) return { ok: false, error: "partner_is_self" };

  const taken = new Set<string>();
  for (const row of existing) {
    taken.add(row.player_id);
    if (row.partner_id) taken.add(row.partner_id);
  }
  if (taken.has(captainId)) return { ok: false, error: "already_registered" };
  if (taken.has(partnerId)) return { ok: false, error: "partner_already_registered" };
  return { ok: true, partnerId };
}

/**
 * Seeding rating of a pair — the plain average of both players' doubles Elo,
 * rounded to the nearest integer. Missing ratings fall back to the 1000 base.
 */
export function pairSeedElo(captainElo: number | null, partnerElo: number | null): number {
  const a = captainElo ?? 1000;
  const b = partnerElo ?? 1000;
  return Math.round((a + b) / 2);
}

/**
 * "Иванов / Петров" display line for a pair. Falls back to an em dash for a
 * missing captain name; a missing partner name renders as "Иванов / —" so it
 * is visible that the pair is incomplete.
 */
export function composePairName(
  captainName: string | null | undefined,
  partnerName: string | null | undefined,
): string {
  const cap = captainName?.trim() || "—";
  const par = partnerName?.trim() || "—";
  return `${cap} / ${par}`;
}
