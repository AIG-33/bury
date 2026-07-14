import { describe, it, expect } from "vitest";
import {
  decideApplication,
  canSetParticipantStatus,
  hasCapacity,
  type ExistingApplication,
} from "./applications";

const NOW = new Date("2026-07-14T12:00:00Z");

function baseArgs(overrides: Partial<Parameters<typeof decideApplication>[0]> = {}) {
  return {
    mode: "manual" as const,
    tournamentStatus: "registration" as const,
    ownerId: "owner-1",
    playerId: "player-1",
    registrationDeadline: null,
    now: NOW,
    approvedCount: 0,
    maxParticipants: null,
    existing: null,
    ...overrides,
  };
}

describe("hasCapacity", () => {
  it("is unlimited when max_participants is null", () => {
    expect(hasCapacity(999, null)).toBe(true);
  });
  it("allows below the cap and blocks at the cap", () => {
    expect(hasCapacity(7, 8)).toBe(true);
    expect(hasCapacity(8, 8)).toBe(false);
    expect(hasCapacity(9, 8)).toBe(false);
  });
});

describe("decideApplication — guards", () => {
  it("rejects the tournament owner", () => {
    const r = decideApplication(baseArgs({ playerId: "owner-1" }));
    expect(r).toEqual({ ok: false, error: "cant_apply_to_own_tournament" });
  });

  it("rejects when registration is not open (draft / in_progress / finished)", () => {
    for (const status of ["draft", "in_progress", "finished", "cancelled"] as const) {
      const r = decideApplication(baseArgs({ tournamentStatus: status }));
      expect(r).toEqual({ ok: false, error: "registration_closed" });
    }
  });

  it("rejects after the registration deadline", () => {
    const r = decideApplication(baseArgs({ registrationDeadline: "2026-07-13T23:59:59Z" }));
    expect(r).toEqual({ ok: false, error: "deadline_passed" });
  });

  it("accepts before the registration deadline", () => {
    const r = decideApplication(baseArgs({ registrationDeadline: "2026-07-15T23:59:59Z" }));
    expect(r.ok).toBe(true);
  });

  it("rejects when the field is full — in both modes", () => {
    for (const mode of ["manual", "auto"] as const) {
      const r = decideApplication(baseArgs({ mode, approvedCount: 8, maxParticipants: 8 }));
      expect(r).toEqual({ ok: false, error: "full" });
    }
  });
});

describe("decideApplication — mode outcomes", () => {
  it("manual mode creates a pending application", () => {
    const r = decideApplication(baseArgs({ mode: "manual" }));
    expect(r).toEqual({ ok: true, nextStatus: "pending", noop: false });
  });

  it("auto mode approves immediately", () => {
    const r = decideApplication(baseArgs({ mode: "auto" }));
    expect(r).toEqual({ ok: true, nextStatus: "approved", noop: false });
  });

  it("auto mode approves the last remaining seat", () => {
    const r = decideApplication(baseArgs({ mode: "auto", approvedCount: 7, maxParticipants: 8 }));
    expect(r).toEqual({ ok: true, nextStatus: "approved", noop: false });
  });
});

describe("decideApplication — re-application over an existing row", () => {
  const pendingLive: ExistingApplication = { status: "pending", withdrawn: false };
  const approvedLive: ExistingApplication = { status: "approved", withdrawn: false };
  const rejected: ExistingApplication = { status: "rejected", withdrawn: false };
  const withdrawn: ExistingApplication = { status: "approved", withdrawn: true };

  it("live pending application is a no-op (stays pending)", () => {
    const r = decideApplication(baseArgs({ existing: pendingLive }));
    expect(r).toEqual({ ok: true, nextStatus: "pending", noop: true });
  });

  it("live approved participation is a no-op even in auto mode", () => {
    const r = decideApplication(baseArgs({ mode: "auto", existing: approvedLive }));
    expect(r).toEqual({ ok: true, nextStatus: "approved", noop: true });
  });

  it("a pending application is NOT silently auto-approved by a mode switch", () => {
    const r = decideApplication(baseArgs({ mode: "auto", existing: pendingLive }));
    expect(r).toEqual({ ok: true, nextStatus: "pending", noop: true });
  });

  it("rejected row is resurrected: pending in manual mode", () => {
    const r = decideApplication(baseArgs({ mode: "manual", existing: rejected }));
    expect(r).toEqual({ ok: true, nextStatus: "pending", noop: false });
  });

  it("rejected row is resurrected: approved in auto mode", () => {
    const r = decideApplication(baseArgs({ mode: "auto", existing: rejected }));
    expect(r).toEqual({ ok: true, nextStatus: "approved", noop: false });
  });

  it("withdrawn row is resurrected with a fresh decision", () => {
    const manual = decideApplication(baseArgs({ mode: "manual", existing: withdrawn }));
    expect(manual).toEqual({ ok: true, nextStatus: "pending", noop: false });
    const auto = decideApplication(baseArgs({ mode: "auto", existing: withdrawn }));
    expect(auto).toEqual({ ok: true, nextStatus: "approved", noop: false });
  });
});

describe("canSetParticipantStatus (organizer approve/reject)", () => {
  it("blocks decisions on finished or cancelled tournaments", () => {
    for (const status of ["finished", "cancelled"] as const) {
      const r = canSetParticipantStatus({
        target: "approved",
        tournamentStatus: status,
        approvedCount: 0,
        maxParticipants: null,
      });
      expect(r).toEqual({ ok: false, error: "tournament_locked" });
    }
  });

  it("blocks approval when the field is full", () => {
    const r = canSetParticipantStatus({
      target: "approved",
      tournamentStatus: "registration",
      approvedCount: 8,
      maxParticipants: 8,
    });
    expect(r).toEqual({ ok: false, error: "tournament_full" });
  });

  it("allows rejection even when the field is full", () => {
    const r = canSetParticipantStatus({
      target: "rejected",
      tournamentStatus: "registration",
      approvedCount: 8,
      maxParticipants: 8,
    });
    expect(r).toEqual({ ok: true });
  });

  it("allows approval while seats remain", () => {
    const r = canSetParticipantStatus({
      target: "approved",
      tournamentStatus: "registration",
      approvedCount: 7,
      maxParticipants: 8,
    });
    expect(r).toEqual({ ok: true });
  });
});
