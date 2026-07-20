import { describe, expect, it } from "vitest";
import { validatePairRegistration, pairSeedElo, composePairName } from "../pairs";

describe("validatePairRegistration", () => {
  const existing = [
    { player_id: "cap1", partner_id: "par1" },
    { player_id: "cap2", partner_id: null },
  ];

  it("accepts a fresh pair", () => {
    const r = validatePairRegistration({ captainId: "capX", partnerId: "parX", existing });
    expect(r).toEqual({ ok: true, partnerId: "parX" });
  });

  it("requires a partner", () => {
    expect(validatePairRegistration({ captainId: "capX", partnerId: null, existing })).toEqual({
      ok: false,
      error: "partner_required",
    });
    expect(
      validatePairRegistration({ captainId: "capX", partnerId: undefined, existing }),
    ).toEqual({ ok: false, error: "partner_required" });
  });

  it("rejects registering with yourself", () => {
    expect(validatePairRegistration({ captainId: "capX", partnerId: "capX", existing })).toEqual({
      ok: false,
      error: "partner_is_self",
    });
  });

  it("rejects a captain already present in any slot", () => {
    expect(validatePairRegistration({ captainId: "cap1", partnerId: "parX", existing })).toEqual({
      ok: false,
      error: "already_registered",
    });
    // Present as somebody's partner counts too.
    expect(validatePairRegistration({ captainId: "par1", partnerId: "parX", existing })).toEqual({
      ok: false,
      error: "already_registered",
    });
  });

  it("rejects a partner already present in any slot", () => {
    expect(validatePairRegistration({ captainId: "capX", partnerId: "cap2", existing })).toEqual({
      ok: false,
      error: "partner_already_registered",
    });
    expect(validatePairRegistration({ captainId: "capX", partnerId: "par1", existing })).toEqual({
      ok: false,
      error: "partner_already_registered",
    });
  });
});

describe("pairSeedElo", () => {
  it("averages both ratings and rounds", () => {
    expect(pairSeedElo(1200, 1000)).toBe(1100);
    expect(pairSeedElo(1001, 1000)).toBe(1001); // 1000.5 rounds up
  });

  it("falls back to 1000 for missing ratings", () => {
    expect(pairSeedElo(null, 1200)).toBe(1100);
    expect(pairSeedElo(null, null)).toBe(1000);
  });
});

describe("composePairName", () => {
  it("joins names with a slash", () => {
    expect(composePairName("Иванов", "Петров")).toBe("Иванов / Петров");
  });

  it("marks missing names with an em dash", () => {
    expect(composePairName(null, "Петров")).toBe("— / Петров");
    expect(composePairName("Иванов", "  ")).toBe("Иванов / —");
  });
});
