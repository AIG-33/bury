import { describe, expect, it } from "vitest";
import { validateMatchParticipants } from "../participants";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const D = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe("validateMatchParticipants — singles", () => {
  it("accepts two distinct players", () => {
    const r = validateMatchParticipants({
      reporterId: A,
      opponentId: B,
      isDoubles: false,
    });
    expect(r).toEqual({
      ok: true,
      p1_id: A,
      p1_partner_id: null,
      p2_id: B,
      p2_partner_id: null,
      allIds: [A, B],
    });
  });

  it("rejects playing against yourself", () => {
    const r = validateMatchParticipants({
      reporterId: A,
      opponentId: A,
      isDoubles: false,
    });
    expect(r).toEqual({ ok: false, error: "self_match" });
  });
});

describe("validateMatchParticipants — doubles", () => {
  it("accepts four distinct players and maps sides", () => {
    const r = validateMatchParticipants({
      reporterId: A,
      opponentId: C,
      isDoubles: true,
      myPartnerId: B,
      opponentPartnerId: D,
    });
    expect(r).toEqual({
      ok: true,
      p1_id: A,
      p1_partner_id: B,
      p2_id: C,
      p2_partner_id: D,
      allIds: [A, B, C, D],
    });
  });

  it("requires both partners", () => {
    expect(
      validateMatchParticipants({
        reporterId: A,
        opponentId: C,
        isDoubles: true,
        myPartnerId: B,
        opponentPartnerId: null,
      }),
    ).toEqual({ ok: false, error: "missing_partner" });
    expect(
      validateMatchParticipants({
        reporterId: A,
        opponentId: C,
        isDoubles: true,
        myPartnerId: undefined,
        opponentPartnerId: D,
      }),
    ).toEqual({ ok: false, error: "missing_partner" });
  });

  it("rejects the same player in two slots", () => {
    expect(
      validateMatchParticipants({
        reporterId: A,
        opponentId: C,
        isDoubles: true,
        myPartnerId: B,
        opponentPartnerId: B,
      }),
    ).toEqual({ ok: false, error: "duplicate_player" });
  });

  it("rejects the reporter appearing on the other side", () => {
    expect(
      validateMatchParticipants({
        reporterId: A,
        opponentId: A,
        isDoubles: true,
        myPartnerId: B,
        opponentPartnerId: D,
      }),
    ).toEqual({ ok: false, error: "self_match" });
  });
});
