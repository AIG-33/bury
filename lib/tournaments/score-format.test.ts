import { describe, it, expect } from "vitest";
import { setWinner } from "./score-format";

describe("setWinner", () => {
  it("picks the side with more games", () => {
    expect(setWinner({ p1: 6, p2: 4 })).toBe("p1");
    expect(setWinner({ p1: 4, p2: 6 })).toBe("p2");
    expect(setWinner({ p1: 7, p2: 6, tb_p1: 7, tb_p2: 3 })).toBe("p1");
    expect(setWinner({ p1: 6, p2: 7, tb_p1: 5, tb_p2: 7 })).toBe("p2");
  });

  it("uses the tiebreak when games are equal", () => {
    expect(setWinner({ p1: 6, p2: 6, tb_p1: 7, tb_p2: 5 })).toBe("p1");
    expect(setWinner({ p1: 6, p2: 6, tb_p1: 3, tb_p2: 10 })).toBe("p2");
  });

  it("treats a one-sided tiebreak record as that side's win", () => {
    expect(setWinner({ p1: 6, p2: 6, tb_p1: 7 })).toBe("p1");
    expect(setWinner({ p1: 6, p2: 6, tb_p1: null, tb_p2: 10 })).toBe("p2");
  });

  it("returns null for genuinely tied sets", () => {
    expect(setWinner({ p1: 0, p2: 0 })).toBeNull();
    expect(setWinner({ p1: 6, p2: 6 })).toBeNull();
    expect(setWinner({ p1: 6, p2: 6, tb_p1: null, tb_p2: null })).toBeNull();
    expect(setWinner({ p1: 6, p2: 6, tb_p1: 5, tb_p2: 5 })).toBeNull();
  });
});
