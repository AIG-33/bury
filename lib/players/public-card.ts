// =============================================================================
// Pure mappers + invariants for the public players directory.
//
// Kept in `lib/` (not in the action file) so they're trivially unit-testable
// without spinning up Supabase. The server action just calls into here.
// =============================================================================

import { TIME_SLOTS, WEEKDAYS, type Availability } from "@/lib/profile/schema";
import type { DayPart, Weekday } from "@/lib/matching/find-player";

/**
 * The raw row shape we accept from `public_player_directory`. Any field beyond
 * this list is a *bug* — the public view must never expose PII.
 *
 * Keep this list in sync with the migration:
 *   supabase/migrations/20260511010000_public_player_directory.sql
 */
export const PUBLIC_DIRECTORY_COLUMNS = [
  "id",
  "display_name",
  "avatar_url",
  "city",
  "district_id",
  "dominant_hand",
  "backhand_style",
  "favorite_surface",
  "current_elo",
  "elo_status",
  "rated_matches_count",
  "availability",
  "last_match_at",
  "is_coach",
  "created_at",
] as const;

export type PublicDirectoryRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  district_id: string | null;
  dominant_hand: "R" | "L" | null;
  backhand_style: "one_handed" | "two_handed" | null;
  favorite_surface: "hard" | "clay" | "grass" | "carpet" | null;
  current_elo: number;
  elo_status: "provisional" | "established";
  rated_matches_count: number;
  availability: Partial<Availability> | null;
  last_match_at: string | null;
  is_coach: boolean;
  // created_at deliberately optional in the row type — we don't render it.
};

export type PublicExternalRating = {
  source: "liga_tennisa";
  external_url: string;
  display_tier: string;
  external_elo: number;
};

export type PublicPlayerCard = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  district_id: string | null;
  district_name: string | null;
  current_elo: number;
  elo_status: "provisional" | "established";
  rated_matches_count: number;
  dominant_hand: "R" | "L" | null;
  backhand_style: "one_handed" | "two_handed" | null;
  favorite_surface: "hard" | "clay" | "grass" | "carpet" | null;
  days_since_last_match: number | null;
  is_coach: boolean;
  external_rating: PublicExternalRating | null;
  available_slots: Array<{ weekday: Weekday; daypart: DayPart }>;
};

/**
 * The closed set of keys that may appear on a {@link PublicPlayerCard}. Used
 * as a runtime guard in the unit test to prove no leak ever creeps in.
 */
export const PUBLIC_CARD_KEYS = [
  "id",
  "display_name",
  "avatar_url",
  "city",
  "district_id",
  "district_name",
  "current_elo",
  "elo_status",
  "rated_matches_count",
  "dominant_hand",
  "backhand_style",
  "favorite_surface",
  "days_since_last_match",
  "is_coach",
  "external_rating",
  "available_slots",
] as const satisfies ReadonlyArray<keyof PublicPlayerCard>;

/** Keys that must NEVER appear on a public card. Locked-in by test. */
export const FORBIDDEN_PII_KEYS = [
  "whatsapp",
  "phone",
  "telegram_username",
  "social_links",
  "email",
  "email_local",
  "health_notes",
  "emergency_contact",
  "consent_terms_at",
  "consent_privacy_at",
  "locale",
  "timezone",
  "lat",
  "lng",
] as const;

/**
 * Pure transform: directory row → public card.
 * Does not perform filtering — the caller decides whether to drop a card.
 */
export function toPublicPlayerCard(
  row: PublicDirectoryRow,
  external: PublicExternalRating | null,
  districtName: string | null,
  now: number,
): PublicPlayerCard {
  const availability = (row.availability ?? {}) as Partial<Availability>;
  const slots: Array<{ weekday: Weekday; daypart: DayPart }> = [];
  for (const wd of WEEKDAYS) {
    const set = new Set(availability[wd] ?? []);
    for (const dp of TIME_SLOTS) {
      if (set.has(dp)) slots.push({ weekday: wd, daypart: dp });
    }
  }

  const days =
    row.last_match_at != null
      ? Math.floor((now - Date.parse(row.last_match_at)) / (24 * 60 * 60 * 1000))
      : null;

  return {
    id: row.id,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    city: row.city,
    district_id: row.district_id,
    district_name: districtName,
    current_elo: row.current_elo,
    elo_status: row.elo_status,
    rated_matches_count: row.rated_matches_count,
    dominant_hand: row.dominant_hand,
    backhand_style: row.backhand_style,
    favorite_surface: row.favorite_surface,
    days_since_last_match: days,
    is_coach: row.is_coach,
    external_rating: external,
    available_slots: slots,
  };
}
