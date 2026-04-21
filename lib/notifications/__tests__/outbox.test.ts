import { describe, expect, it } from "vitest";
import { backoffMs, MAX_ATTEMPTS } from "../outbox";

describe("backoffMs", () => {
  it("returns 60s for first retry", () => {
    expect(backoffMs(1)).toBe(60_000);
  });
  it("escalates monotonically up to 4 hours", () => {
    const ladder = [1, 2, 3, 4, 5].map((a) => backoffMs(a));
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]).toBeGreaterThanOrEqual(ladder[i - 1]);
    }
    expect(ladder.at(-1)).toBe(4 * 60 * 60_000);
  });
  it("clamps beyond ladder length", () => {
    expect(backoffMs(99)).toBe(4 * 60 * 60_000);
  });
});

describe("MAX_ATTEMPTS", () => {
  it("is a small positive integer", () => {
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(MAX_ATTEMPTS).toBeLessThan(20);
  });
});
