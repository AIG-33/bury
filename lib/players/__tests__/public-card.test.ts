import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_PII_KEYS,
  PUBLIC_CARD_KEYS,
  PUBLIC_DIRECTORY_COLUMNS,
  toPublicPlayerCard,
  type PublicDirectoryRow,
  type PublicExternalRating,
} from "../public-card";

const NOW = Date.parse("2026-05-11T12:00:00.000Z");

function makeRow(overrides: Partial<PublicDirectoryRow> = {}): PublicDirectoryRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    display_name: "Иван Тест",
    avatar_url: null,
    city: "Минск",
    country: "BY",
    dominant_hand: "R",
    backhand_style: "two_handed",
    favorite_surface: "hard",
    current_elo: 1200,
    elo_status: "established",
    rated_matches_count: 12,
    current_elo_doubles: 1050,
    elo_status_doubles: "provisional",
    rated_matches_count_doubles: 2,
    availability: { mon: ["evening"], wed: ["evening", "morning"] },
    last_match_at: "2026-05-04T18:00:00.000Z",
    is_coach: false,
    ...overrides,
  };
}

describe("toPublicPlayerCard", () => {
  it("extracts every (weekday, daypart) pair from the availability JSONB", () => {
    const card = toPublicPlayerCard(makeRow(), null, NOW);

    expect(card.available_slots).toEqual([
      { weekday: "mon", daypart: "evening" },
      { weekday: "wed", daypart: "morning" },
      { weekday: "wed", daypart: "evening" },
    ]);
  });

  it("computes whole-day distance to last match", () => {
    const card = toPublicPlayerCard(makeRow(), null, NOW);
    // 2026-05-04T18:00 → 2026-05-11T12:00 = 6.75 days → floor = 6
    expect(card.days_since_last_match).toBe(6);
  });

  it("returns null distance when the player has never played a rated match", () => {
    const card = toPublicPlayerCard(makeRow({ last_match_at: null }), null, NOW);
    expect(card.days_since_last_match).toBeNull();
  });

  it("propagates a Liga Tennisa badge when present", () => {
    const ext: PublicExternalRating = {
      source: "liga_tennisa",
      external_url: "https://www.ligatennisa.com/player/123",
      display_tier: "B2",
      external_elo: 1180,
    };
    const card = toPublicPlayerCard(makeRow(), ext, NOW);
    expect(card.external_rating).toEqual(ext);
  });

  it("treats a missing availability JSONB as no slots", () => {
    const card = toPublicPlayerCard(makeRow({ availability: null }), null, NOW);
    expect(card.available_slots).toEqual([]);
  });

  it("passes the ISO country code through unchanged", () => {
    expect(toPublicPlayerCard(makeRow(), null, NOW).country).toBe("BY");
    expect(toPublicPlayerCard(makeRow({ country: null }), null, NOW).country).toBeNull();
  });
});

describe("public card schema invariants", () => {
  it("only emits whitelisted public keys — never PII", () => {
    const card = toPublicPlayerCard(makeRow(), null, NOW);
    const keys = Object.keys(card).sort();

    expect(keys).toEqual([...PUBLIC_CARD_KEYS].sort());
    for (const forbidden of FORBIDDEN_PII_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("survives unexpected extra columns silently — they don't leak", () => {
    // Even if the underlying view ever leaked an extra column at runtime
    // (e.g. someone adds a column to the view by mistake), the mapper
    // builds the card from a fixed shape and ignores anything else.
    const tainted = {
      ...makeRow(),
      // PII fields that MUST never reach the public surface:
      whatsapp: "+375290000000",
      phone: "+375290000000",
      email: "leak@example.com",
      health_notes: "knee injury",
      consent_terms_at: "2026-05-01T00:00:00.000Z",
      locale: "ru",
    } as unknown as PublicDirectoryRow;

    const card = toPublicPlayerCard(tainted, null, NOW);
    const keys = Object.keys(card);

    for (const forbidden of FORBIDDEN_PII_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("public_player_directory columns list is in sync with the row type", () => {
    // If you add a column to the view migration, add it here too. If you
    // add a non-public column to PublicDirectoryRow, this list is the
    // first place to check the view — runtime SELECT must not pull more.
    expect(PUBLIC_DIRECTORY_COLUMNS).toContain("id");
    expect(PUBLIC_DIRECTORY_COLUMNS).toContain("display_name");
    expect(PUBLIC_DIRECTORY_COLUMNS).toContain("availability");
    expect(PUBLIC_DIRECTORY_COLUMNS).not.toContain("whatsapp");
    expect(PUBLIC_DIRECTORY_COLUMNS).not.toContain("phone");
    expect(PUBLIC_DIRECTORY_COLUMNS).not.toContain("email_local");
    expect(PUBLIC_DIRECTORY_COLUMNS).not.toContain("social_links");
    expect(PUBLIC_DIRECTORY_COLUMNS).not.toContain("health_notes");
  });
});
