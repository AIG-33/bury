import type { ApplicationMode, TournamentStatus } from "./schema";

// =============================================================================
// Pure decision logic for the tournament application flow. Server actions
// (applyToTournament, setParticipantStatus) feed DB state in and act on the
// verdict, so the state machine is unit-testable without Supabase.
// =============================================================================

export type ParticipantStatus = "pending" | "approved" | "rejected";

export type ExistingApplication = {
  status: ParticipantStatus;
  withdrawn: boolean;
};

export type ApplyDecision =
  | { ok: true; nextStatus: "pending" | "approved"; noop: boolean }
  | { ok: false; error: ApplyError };

export type ApplyError =
  | "cant_apply_to_own_tournament"
  | "registration_closed"
  | "deadline_passed"
  | "full";

/** True while another approved, non-withdrawn player still fits. */
export function hasCapacity(approvedCount: number, maxParticipants: number | null): boolean {
  return maxParticipants == null || approvedCount < maxParticipants;
}

/**
 * Decide what happens when a player taps "Apply".
 *
 *   – manual mode → the row lands in 'pending' and waits for the organizer;
 *   – auto mode   → the row is approved immediately (capacity already
 *     re-checked here; the caller writes with the service role because RLS
 *     intentionally keeps client-side inserts pending-only).
 *
 * Re-applying over an existing row resurrects it: a live pending row is a
 * no-op, a rejected/withdrawn row gets a fresh decision in the current mode.
 */
export function decideApplication(args: {
  mode: ApplicationMode;
  tournamentStatus: TournamentStatus;
  ownerId: string;
  playerId: string;
  registrationDeadline: string | null;
  now: Date;
  approvedCount: number;
  maxParticipants: number | null;
  existing: ExistingApplication | null;
}): ApplyDecision {
  if (args.ownerId === args.playerId) {
    return { ok: false, error: "cant_apply_to_own_tournament" };
  }
  if (args.tournamentStatus !== "registration") {
    return { ok: false, error: "registration_closed" };
  }
  if (args.registrationDeadline && new Date(args.registrationDeadline) < args.now) {
    return { ok: false, error: "deadline_passed" };
  }
  if (!hasCapacity(args.approvedCount, args.maxParticipants)) {
    return { ok: false, error: "full" };
  }

  const alreadyLive =
    args.existing != null &&
    !args.existing.withdrawn &&
    (args.existing.status === "pending" || args.existing.status === "approved");

  const nextStatus: "pending" | "approved" = args.mode === "auto" ? "approved" : "pending";
  if (alreadyLive) {
    // Keep whatever state the live row is in — don't demote an approved
    // player back to pending or silently auto-approve a pending one.
    return {
      ok: true,
      nextStatus: args.existing!.status as "pending" | "approved",
      noop: true,
    };
  }
  return { ok: true, nextStatus, noop: false };
}

export type DecisionError = "tournament_locked" | "tournament_full";

/**
 * Guard for the organizer-side approve/reject action. Approval must respect
 * the seat cap; rejection is always allowed while the tournament is live.
 */
export function canSetParticipantStatus(args: {
  target: "approved" | "rejected";
  tournamentStatus: TournamentStatus;
  approvedCount: number;
  maxParticipants: number | null;
}): { ok: true } | { ok: false; error: DecisionError } {
  if (args.tournamentStatus === "finished" || args.tournamentStatus === "cancelled") {
    return { ok: false, error: "tournament_locked" };
  }
  if (args.target === "approved" && !hasCapacity(args.approvedCount, args.maxParticipants)) {
    return { ok: false, error: "tournament_full" };
  }
  return { ok: true };
}
