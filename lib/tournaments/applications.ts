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

// Europe/Minsk is permanently UTC+3 (no DST since 2011), so a fixed offset is
// exact and keeps this module pure/unit-testable without date-fns-tz.
const MINSK_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Whether the registration deadline has passed, treating the deadline as
 * valid through the END of its calendar day in Europe/Minsk.
 *
 * The UI presents the deadline as a plain date («Регистрация до 21 июля») and
 * the form writes a date-only string into the timestamptz column, which
 * Postgres stores as midnight UTC. Comparing that raw instant against `now`
 * closed registration at 03:00 Minsk ON the deadline day — players applying
 * later that day got `deadline_passed` out of a visibly open tournament.
 */
export function registrationDeadlinePassed(deadline: string, now: Date): boolean {
  // Date-only values are anchored to the Minsk calendar day; full timestamps
  // (the timestamptz round-trip) are converted to their Minsk calendar day.
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    ? Date.parse(`${deadline}T00:00:00+03:00`)
    : Date.parse(deadline);
  if (Number.isNaN(instant)) return false;
  const minskWallClock = new Date(instant + MINSK_UTC_OFFSET_MS);
  const deadlineDayEndUtc =
    Date.UTC(
      minskWallClock.getUTCFullYear(),
      minskWallClock.getUTCMonth(),
      minskWallClock.getUTCDate() + 1,
    ) - MINSK_UTC_OFFSET_MS;
  return now.getTime() >= deadlineDayEndUtc;
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
  if (
    args.registrationDeadline &&
    registrationDeadlinePassed(args.registrationDeadline, args.now)
  ) {
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
