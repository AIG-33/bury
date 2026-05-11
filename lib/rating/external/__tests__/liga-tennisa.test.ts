import { describe, it, expect } from "vitest";
import {
  LOCAL_ELO_FALLBACK,
  LOCAL_ELO_MAX,
  LOCAL_ELO_MIN,
  ltBackhandToStyle,
  ltDisplayName,
  ltEloToLocalElo,
  ltForehandToHand,
  ltProfileUrl,
  ltTierForElo,
  normaliseForMatch,
  rankLtCandidates,
} from "../liga-tennisa";
import {
  LtPlayerDetail,
  LtPlayerListItem,
  sanitiseLtPayload,
} from "@/lib/validators/external-ratings";

// =============================================================================
// Tier mapping
// =============================================================================

describe("ltTierForElo", () => {
  it("returns Rookies for null/undefined/non-finite", () => {
    expect(ltTierForElo(null)).toBe("Rookies");
    expect(ltTierForElo(undefined)).toBe("Rookies");
    expect(ltTierForElo(Number.NaN)).toBe("Rookies");
  });

  it("returns Rookies for very low values", () => {
    expect(ltTierForElo(0)).toBe("Rookies");
    expect(ltTierForElo(-100)).toBe("Rookies");
    expect(ltTierForElo(900)).toBe("Rookies");
    expect(ltTierForElo(1049)).toBe("Rookies");
  });

  it("buckets a typical amateur correctly", () => {
    expect(ltTierForElo(1063)).toBe("Satellite"); // Виталий Охрименко
    expect(ltTierForElo(1224)).toBe("Satellite");
    expect(ltTierForElo(1225)).toBe("Futures");
    expect(ltTierForElo(1424)).toBe("Futures");
    expect(ltTierForElo(1425)).toBe("Legger");
    expect(ltTierForElo(1630)).toBe("Challenger"); // Максим Горбацевич
    expect(ltTierForElo(1849)).toBe("Challenger");
    expect(ltTierForElo(1850)).toBe("Masters");
    expect(ltTierForElo(2049)).toBe("Masters");
    expect(ltTierForElo(2050)).toBe("Supreme");
    expect(ltTierForElo(2249)).toBe("Supreme");
  });

  it("returns Pro for very high values", () => {
    expect(ltTierForElo(2250)).toBe("Pro");
    expect(ltTierForElo(2400)).toBe("Pro");
    expect(ltTierForElo(9999)).toBe("Pro");
  });
});

// =============================================================================
// Elo conversion + clamp
// =============================================================================

describe("ltEloToLocalElo", () => {
  it("uses fallback for null / 0 / non-finite (provisional players)", () => {
    expect(ltEloToLocalElo(null)).toEqual({
      elo: LOCAL_ELO_FALLBACK,
      clamped: false,
      fallback: true,
    });
    expect(ltEloToLocalElo(undefined)).toEqual({
      elo: LOCAL_ELO_FALLBACK,
      clamped: false,
      fallback: true,
    });
    expect(ltEloToLocalElo(0)).toEqual({
      elo: LOCAL_ELO_FALLBACK,
      clamped: false,
      fallback: true,
    });
    expect(ltEloToLocalElo(Number.NaN)).toEqual({
      elo: LOCAL_ELO_FALLBACK,
      clamped: false,
      fallback: true,
    });
  });

  it("returns the rounded LT Elo when in-range", () => {
    expect(ltEloToLocalElo(1063)).toEqual({ elo: 1063, clamped: false, fallback: false });
    expect(ltEloToLocalElo(1630.4)).toEqual({ elo: 1630, clamped: false, fallback: false });
    expect(ltEloToLocalElo(1630.6)).toEqual({ elo: 1631, clamped: false, fallback: false });
    expect(ltEloToLocalElo(2199)).toEqual({ elo: 2199, clamped: false, fallback: false });
  });

  it("clamps to [800, 2200]", () => {
    expect(ltEloToLocalElo(700)).toEqual({
      elo: LOCAL_ELO_MIN,
      clamped: true,
      fallback: false,
    });
    expect(ltEloToLocalElo(3000)).toEqual({
      elo: LOCAL_ELO_MAX,
      clamped: true,
      fallback: false,
    });
  });
});

// =============================================================================
// Hand / backhand mapping
// =============================================================================

describe("ltForehandToHand", () => {
  it("maps Russian Cyrillic", () => {
    expect(ltForehandToHand("Правша")).toBe("R");
    expect(ltForehandToHand("правша")).toBe("R");
    expect(ltForehandToHand("Левша")).toBe("L");
  });
  it("maps English aliases", () => {
    expect(ltForehandToHand("Right")).toBe("R");
    expect(ltForehandToHand("LEFT")).toBe("L");
  });
  it("returns null for unknown / empty", () => {
    expect(ltForehandToHand(null)).toBeNull();
    expect(ltForehandToHand("")).toBeNull();
    expect(ltForehandToHand("обе руки")).toBeNull();
  });
});

describe("ltBackhandToStyle", () => {
  it("maps Russian Cyrillic", () => {
    expect(ltBackhandToStyle("Двуручный")).toBe("two_handed");
    expect(ltBackhandToStyle("одноручный")).toBe("one_handed");
  });
  it("maps English aliases", () => {
    expect(ltBackhandToStyle("two-handed")).toBe("two_handed");
    expect(ltBackhandToStyle("one handed")).toBe("one_handed");
  });
  it("returns null for unknown / empty", () => {
    expect(ltBackhandToStyle(null)).toBeNull();
    expect(ltBackhandToStyle("")).toBeNull();
    expect(ltBackhandToStyle("неизвестно")).toBeNull();
  });
});

// =============================================================================
// Display name + URL
// =============================================================================

describe("ltDisplayName", () => {
  it("joins first + last", () => {
    expect(ltDisplayName("Максим", "Горбацевич")).toBe("Максим Горбацевич");
  });
  it("trims whitespace and collapses", () => {
    expect(ltDisplayName("  Олег  ", "  Шведов  ")).toBe("Олег Шведов");
    expect(ltDisplayName("Виталий ", "Охрименко")).toBe("Виталий Охрименко");
  });
  it("survives missing parts", () => {
    expect(ltDisplayName(null, "Захарова")).toBe("Захарова");
    expect(ltDisplayName("Анна", null)).toBe("Анна");
    expect(ltDisplayName(null, null)).toBe("");
  });
});

describe("ltProfileUrl", () => {
  it("builds the canonical URL", () => {
    expect(ltProfileUrl(2220)).toBe("https://www.ligatennisa.com/players/2220");
    expect(ltProfileUrl("211")).toBe("https://www.ligatennisa.com/players/211");
  });
});

// =============================================================================
// Normalisation + fuzzy ranking
// =============================================================================

describe("normaliseForMatch", () => {
  it("lower-cases", () => {
    expect(normaliseForMatch("Максим")).toBe("максим");
  });
  it("strips diacritics", () => {
    expect(normaliseForMatch("Wójcik")).toBe("wojcik");
  });
  it("collapses whitespace", () => {
    expect(normaliseForMatch("  hello   world  ")).toBe("hello world");
  });
  it("returns empty for null/undefined/empty", () => {
    expect(normaliseForMatch(null)).toBe("");
    expect(normaliseForMatch(undefined)).toBe("");
    expect(normaliseForMatch("")).toBe("");
  });
});

describe("rankLtCandidates", () => {
  const players: LtPlayerListItem[] = [
    {
      id: 2220,
      first_name: "Максим",
      last_name: "Горбацевич",
      city: "Минск",
      country: "BY",
      avatar: null,
      forehand: null,
      backhand: null,
      insta_link: null,
      in_tennis_from: null,
      date_of_birth: null,
      height: null,
      level: 1,
      premium: false,
      ratings_count: 0,
      metadata: null,
    },
    {
      id: 211,
      first_name: "Виталий",
      last_name: "Охрименко",
      city: "Минск",
      country: "BY",
      avatar: null,
      forehand: null,
      backhand: null,
      insta_link: null,
      in_tennis_from: null,
      date_of_birth: null,
      height: null,
      level: 1,
      premium: false,
      ratings_count: 0,
      metadata: null,
    },
    {
      id: 1582,
      first_name: "Наталья",
      last_name: "Шонина",
      city: null,
      country: "BY",
      avatar: null,
      forehand: null,
      backhand: null,
      insta_link: null,
      in_tennis_from: null,
      date_of_birth: null,
      height: null,
      level: 1,
      premium: false,
      ratings_count: 0,
      metadata: null,
    },
    {
      id: 9999,
      first_name: "Максим",
      last_name: "Иванов",
      city: "Гродно",
      country: "BY",
      avatar: null,
      forehand: null,
      backhand: null,
      insta_link: null,
      in_tennis_from: null,
      date_of_birth: null,
      height: null,
      level: 1,
      premium: false,
      ratings_count: 0,
      metadata: null,
    },
  ];

  it("returns empty for too-short query", () => {
    expect(rankLtCandidates(players, "")).toEqual([]);
    expect(rankLtCandidates(players, "  ")).toEqual([]);
  });

  it("ranks exact full-name match first", () => {
    const r = rankLtCandidates(players, "Максим Горбацевич");
    expect(r[0]?.id).toBe(2220);
    expect(r[0]?.score).toBeGreaterThan(0.9);
  });

  it("matches by last name only", () => {
    const r = rankLtCandidates(players, "Охрименко");
    expect(r[0]?.id).toBe(211);
  });

  it("ranks two candidates with same first name and uses city as tiebreaker", () => {
    const minsk = rankLtCandidates(players, "Максим", { city: "Минск" });
    const grodno = rankLtCandidates(players, "Максим", { city: "Гродно" });
    expect(minsk[0]?.id).toBe(2220);
    expect(grodno[0]?.id).toBe(9999);
  });

  it("excludes candidates with zero score", () => {
    const r = rankLtCandidates(players, "qwerty");
    expect(r).toEqual([]);
  });

  it("respects the limit option", () => {
    const r = rankLtCandidates(players, "м", { limit: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });
});

// =============================================================================
// Validator boundary — guarantees password_hash never makes it through
// =============================================================================

describe("LT validator boundary", () => {
  const dirtyDetail = {
    id: 2220,
    first_name: "Максим",
    last_name: "Горбацевич",
    date_of_birth: "1983-09-29T00:00:00.000Z",
    city: "Минск",
    country: "Беларусь",
    email: "leak@example.com",
    phone: "375291161491",
    avatar: "https://cdn/avatar.jpg",
    level: 1,
    age: null,
    gameplay_style: "Без счета",
    forehand: "Правша",
    insta_link: "https://www.instagram.com/gmaxby",
    is_coach: null,
    in_tennis_from: "2022-10-25T00:00:00.000Z",
    job_description: "samplify.org",
    technique: 66,
    power: 68,
    quality: 10,
    serve: 74,
    forehand_rating: 75,
    backhand_rating: 60,
    rezany: 0,
    height: 180,
    premium: false,
    isHyped: false,
    backhand: "Двуручный",
    behavior: 100,
    net_game: 63,
    interview_link: "",
    password_hash: "$2b$10$rdS1KlmK6k6hkS29kM0iY",
    last_password_reset: "2026-02-21T17:40:12.099Z",
    ratings_count: 1,
    metadata: {
      doubles: { isCalibrating: false, matchesAgainstCalibrated: 999 },
      singles: { isCalibrating: false, matchesAgainstCalibrated: 999 },
    },
    elo_points: 1630,
    doubles_elo_points: 1502,
    singles_wins: 52,
    ranking_position: 47,
  };

  it("LtPlayerDetail parses but does not expose password_hash", () => {
    const parsed = LtPlayerDetail.parse(dirtyDetail);
    // Sanity — date_of_birth coerced to YYYY-MM-DD.
    expect(parsed.date_of_birth).toBe("1983-09-29");
    expect(parsed.in_tennis_from).toBe("2022-10-25");
    // Schema strips unknown keys (zod default), so password_hash is gone.
    expect(parsed).not.toHaveProperty("password_hash");
    expect(parsed).not.toHaveProperty("last_password_reset");
    expect(parsed).not.toHaveProperty("email");
    expect(parsed).not.toHaveProperty("phone");
  });

  it("sanitiseLtPayload produces a strictly safe payload", () => {
    const parsed = LtPlayerDetail.parse(dirtyDetail);
    const safe = sanitiseLtPayload(parsed);
    expect(safe.id).toBe(2220);
    expect(safe.elo_points).toBe(1630);
    expect(safe.doubles_elo_points).toBe(1502);
    expect(safe.is_calibrating_singles).toBe(false);
    expect(safe.is_calibrating_doubles).toBe(false);
    // Hard guarantees (regression tests).
    expect(safe).not.toHaveProperty("password_hash");
    expect(safe).not.toHaveProperty("last_password_reset");
    expect(safe).not.toHaveProperty("email");
    expect(safe).not.toHaveProperty("phone");
    expect(safe).not.toHaveProperty("job_description");
  });

  it("LtPlayerDetail tolerates list-style nulls and empty strings", () => {
    const parsed = LtPlayerDetail.parse({
      id: 110,
      first_name: "Олег",
      last_name: "Шведов ",
      date_of_birth: null,
      city: "",
      country: "",
      email: null,
      phone: "",
      avatar: "",
      level: 0,
      age: null,
      gameplay_style: "",
      forehand: "",
      insta_link: "",
      is_coach: null,
      in_tennis_from: null,
      job_description: "",
      technique: 0,
      power: 0,
      quality: 0,
      serve: 0,
      forehand_rating: 0,
      backhand_rating: 0,
      rezany: 0,
      height: null,
      premium: false,
      isHyped: false,
      backhand: "",
      behavior: 0,
      net_game: 0,
      interview_link: "",
      password_hash: null,
      last_password_reset: null,
      ratings_count: 0,
      metadata: {
        doubles: { isCalibrating: false, matchesAgainstCalibrated: 999 },
        singles: { isCalibrating: false, matchesAgainstCalibrated: 999 },
      },
      elo_points: null,
      doubles_elo_points: null,
      singles_wins: null,
      ranking_position: null,
    });
    expect(parsed.first_name).toBe("Олег");
    expect(parsed.city).toBeNull();
    expect(parsed.elo_points).toBeNull();
    const safe = sanitiseLtPayload(parsed);
    expect(safe.elo_points).toBeNull();
    expect(safe.is_calibrating_singles).toBe(false);
  });

  it("LtPlayerListItem parses minimal list entries", () => {
    const parsed = LtPlayerListItem.parse({
      id: 1582,
      first_name: "Наталья",
      last_name: "Шонина",
      date_of_birth: null,
      city: null,
      country: "BY",
      email: null,
      phone: null,
      avatar: null,
      level: 1,
      age: null,
      gameplay_style: null,
      forehand: null,
      insta_link: null,
      is_coach: null,
      in_tennis_from: null,
      job_description: null,
      technique: 0,
      power: 0,
      quality: 0,
      serve: 0,
      forehand_rating: 0,
      backhand_rating: 0,
      rezany: 0,
      height: null,
      premium: false,
      isHyped: false,
      backhand: null,
      behavior: 0,
      net_game: 0,
      interview_link: null,
      password_hash: null,
      last_password_reset: null,
      ratings_count: 0,
      metadata: {
        doubles: { isCalibrating: false, matchesAgainstCalibrated: 999 },
        singles: { isCalibrating: false, matchesAgainstCalibrated: 999 },
      },
    });
    expect(parsed.first_name).toBe("Наталья");
    expect(parsed.country).toBe("BY");
  });
});
