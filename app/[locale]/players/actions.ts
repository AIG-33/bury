"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TIME_SLOTS, WEEKDAYS } from "@/lib/profile/schema";
import type { DayPart, Weekday } from "@/lib/matching/find-player";
import {
  toPublicPlayerCard,
  type PublicDirectoryRow,
  type PublicExternalRating,
  type PublicPlayerCard,
} from "@/lib/players/public-card";

export type PublicPlayerProfile = PublicPlayerCard & {
  recent_matches: Array<{
    id: string;
    played_at: string | null;
    is_doubles: boolean;
    is_tournament: boolean;
    tournament_name: string | null;
    won: boolean | null;
    sets: Array<{
      p1_games: number;
      p2_games: number;
      tiebreak_p1: number | null;
      tiebreak_p2: number | null;
    }> | null;
    /** Score formatted from THIS player's perspective. */
    score_for_player: string;
    opponent: {
      id: string | null;
      name: string | null;
      avatar_url: string | null;
    };
    venue_name: string | null;
    venue_city: string | null;
  }>;
};

// =============================================================================
// Public players catalogue.
//
// This file powers the anonymous `/players` page. It deliberately reads from
// the RLS-bypassing `public_player_directory` view (see migration
// `20260511010000_public_player_directory.sql`) — never from `profiles`
// directly — so we cannot accidentally leak phone numbers, social links,
// emails, or anything else PII. Pure card-mapping is in
// `lib/players/public-card.ts` so it can be unit-tested without Supabase.
//
// Authenticated users continue to use the richer `/me/find` flow which has
// availability-overlap matching and pending-proposal exclusion.
// =============================================================================

// =============================================================================
// Filter schema
// =============================================================================

/** UI buckets we expose to guests instead of asking for raw Elo numbers. */
export const LEVEL_BUCKETS = [
  "any",
  "beginner", // ≤ 950
  "intermediate", // 951 – 1300
  "advanced", // 1301 – 1700
  "expert", // ≥ 1701
] as const;
export type LevelBucket = (typeof LEVEL_BUCKETS)[number];

const LEVEL_RANGES: Record<LevelBucket, { min: number; max: number }> = {
  any: { min: 0, max: 4000 },
  beginner: { min: 0, max: 950 },
  intermediate: { min: 951, max: 1300 },
  advanced: { min: 1301, max: 1700 },
  expert: { min: 1701, max: 4000 },
};

const PublicFiltersSchema = z.object({
  districtId: z
    .string()
    .uuid()
    .or(z.literal(""))
    .optional()
    .transform((v): string | null => (v && v !== "" ? v : null)),
  level: z.enum(LEVEL_BUCKETS).default("any"),
  hand: z.enum(["both", "R", "L"]).default("both"),
  /** Optional weekday/daypart slot the user is interested in playing. */
  weekday: z
    .union([z.enum(WEEKDAYS), z.literal("")])
    .optional()
    .transform((v): Weekday | null => (v && v.length > 0 ? (v as Weekday) : null)),
  daypart: z
    .union([z.enum(TIME_SLOTS), z.literal("")])
    .optional()
    .transform((v): DayPart | null => (v && v.length > 0 ? (v as DayPart) : null)),
});

export type PublicFiltersInput = z.input<typeof PublicFiltersSchema>;

export type { PublicPlayerCard } from "@/lib/players/public-card";

export type PublicPlayersResult = {
  results: PublicPlayerCard[];
  total: number;
  /** True if the SQL window was capped — we hint the user to refine filters. */
  truncated: boolean;
};

// =============================================================================
// District options (used by the public filter UI). No auth required.
// =============================================================================

export type PublicDistrictOption = { id: string; name: string; city: string };

export async function loadPublicDistrictOptions(): Promise<PublicDistrictOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("districts")
    .select("id, name, city")
    .eq("country", "BY")
    .order("city", { ascending: true })
    .order("name", { ascending: true })) as {
    data: Array<{ id: string; name: string; city: string }> | null;
  };
  return data ?? [];
}

// =============================================================================
// Main loader
// =============================================================================

const PAGE_LIMIT = 60;

export async function loadPublicPlayers(input: PublicFiltersInput): Promise<PublicPlayersResult> {
  const filters = PublicFiltersSchema.parse(input);
  const range = LEVEL_RANGES[filters.level];

  const supabase = await createSupabaseServerClient();

  let q = supabase
    .from("public_player_directory")
    .select(
      "id, display_name, avatar_url, city, district_id, current_elo, elo_status, " +
        "rated_matches_count, dominant_hand, backhand_style, favorite_surface, " +
        "availability, last_match_at, is_coach",
    )
    .gte("current_elo", range.min)
    .lte("current_elo", range.max)
    .order("current_elo", { ascending: false })
    .limit(PAGE_LIMIT + 1);

  if (filters.districtId) q = q.eq("district_id", filters.districtId);
  if (filters.hand !== "both") q = q.eq("dominant_hand", filters.hand);

  const { data: rows } = (await q) as { data: PublicDirectoryRow[] | null };

  const all = rows ?? [];

  // District names lookup — single round-trip.
  const districtIds = Array.from(
    new Set(all.map((p) => p.district_id).filter((x): x is string => Boolean(x))),
  );
  const districtNames = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as { data: Array<{ id: string; name: string }> | null };
    for (const d of ds ?? []) districtNames.set(d.id, d.name);
  }

  // External ratings (Liga Tennisa) — public-readable per its RLS policy.
  const ids = all.map((p) => p.id);
  const externalRatingByPlayer = new Map<string, PublicExternalRating>();
  if (ids.length > 0) {
    const { data: ext } = (await supabase
      .from("external_ratings")
      .select("player_id, external_url, display_tier, external_elo")
      .eq("source", "liga_tennisa")
      .in("player_id", ids)) as {
      data: Array<{
        player_id: string;
        external_url: string;
        display_tier: string;
        external_elo: number;
      }> | null;
    };
    for (const r of ext ?? []) {
      externalRatingByPlayer.set(r.player_id, {
        source: "liga_tennisa",
        external_url: r.external_url,
        display_tier: r.display_tier,
        external_elo: r.external_elo,
      });
    }
  }

  const now = Date.now();
  const slotFilter =
    filters.weekday && filters.daypart ? { wd: filters.weekday, dp: filters.daypart } : null;

  const truncated = all.length > PAGE_LIMIT;
  const sliced = all.slice(0, PAGE_LIMIT);

  const cards: PublicPlayerCard[] = sliced.flatMap((row) => {
    const card = toPublicPlayerCard(
      row,
      externalRatingByPlayer.get(row.id) ?? null,
      row.district_id ? (districtNames.get(row.district_id) ?? null) : null,
      now,
    );

    if (slotFilter) {
      const matches = card.available_slots.some(
        (s) => s.weekday === slotFilter.wd && s.daypart === slotFilter.dp,
      );
      if (!matches) return [];
    }

    return [card];
  });

  return {
    results: cards,
    total: cards.length,
    truncated,
  };
}

// =============================================================================
// Public single-player profile (`/players/[id]`).
//
// Reads `public_player_directory` for the row, then layers a recent match
// summary from `public_matches_feed` so guests see the player's last games
// (and rough activity). Still NO contact PII.
// =============================================================================

const RECENT_MATCHES_LIMIT = 12;

export async function loadPublicPlayerProfile(
  playerId: string,
): Promise<PublicPlayerProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data: row } = (await supabase
    .from("public_player_directory")
    .select(
      "id, display_name, avatar_url, city, district_id, current_elo, elo_status, " +
        "rated_matches_count, dominant_hand, backhand_style, favorite_surface, " +
        "availability, last_match_at, is_coach",
    )
    .eq("id", playerId)
    .maybeSingle()) as { data: PublicDirectoryRow | null };

  if (!row) return null;

  const [districtName, externalRating, recentMatches] = await Promise.all([
    (async (): Promise<string | null> => {
      if (!row.district_id) return null;
      const { data } = (await supabase
        .from("districts")
        .select("name")
        .eq("id", row.district_id)
        .maybeSingle()) as { data: { name: string } | null };
      return data?.name ?? null;
    })(),
    (async (): Promise<PublicExternalRating | null> => {
      const { data } = (await supabase
        .from("external_ratings")
        .select("external_url, display_tier, external_elo")
        .eq("source", "liga_tennisa")
        .eq("player_id", row.id)
        .maybeSingle()) as {
        data: {
          external_url: string;
          display_tier: string;
          external_elo: number;
        } | null;
      };
      if (!data) return null;
      return { source: "liga_tennisa", ...data };
    })(),
    (async () => {
      const { data } = (await supabase
        .from("public_matches_feed")
        .select(
          "id, played_at, is_doubles, sets, winner_side, " +
            "p1_id, p1_name, p1_avatar, p2_id, p2_name, p2_avatar, " +
            "tournament_id, tournament_name, venue_name, venue_city",
        )
        .or(`p1_id.eq.${row.id},p2_id.eq.${row.id}`)
        .order("played_at", { ascending: false, nullsFirst: false })
        .limit(RECENT_MATCHES_LIMIT)) as {
        data: Array<{
          id: string;
          played_at: string | null;
          is_doubles: boolean;
          sets: Array<{
            p1_games: number;
            p2_games: number;
            tiebreak_p1: number | null;
            tiebreak_p2: number | null;
          }> | null;
          winner_side: "p1" | "p2" | null;
          p1_id: string | null;
          p1_name: string | null;
          p1_avatar: string | null;
          p2_id: string | null;
          p2_name: string | null;
          p2_avatar: string | null;
          tournament_id: string | null;
          tournament_name: string | null;
          venue_name: string | null;
          venue_city: string | null;
        }> | null;
      };

      return (data ?? []).map((m) => {
        const isP1 = m.p1_id === row.id;
        const opponent = isP1
          ? { id: m.p2_id, name: m.p2_name, avatar_url: m.p2_avatar }
          : { id: m.p1_id, name: m.p1_name, avatar_url: m.p1_avatar };
        const won =
          m.winner_side == null
            ? null
            : (isP1 && m.winner_side === "p1") || (!isP1 && m.winner_side === "p2");
        const score_for_player =
          m.sets == null
            ? "—"
            : m.sets
                .map((s) => {
                  const my = isP1 ? s.p1_games : s.p2_games;
                  const op = isP1 ? s.p2_games : s.p1_games;
                  return `${my}-${op}`;
                })
                .join(" · ");
        return {
          id: m.id,
          played_at: m.played_at,
          is_doubles: m.is_doubles,
          is_tournament: m.tournament_id != null,
          tournament_name: m.tournament_name,
          won,
          sets: m.sets,
          score_for_player,
          opponent,
          venue_name: m.venue_name,
          venue_city: m.venue_city,
        };
      });
    })(),
  ]);

  const card = toPublicPlayerCard(row, externalRating, districtName, Date.now());

  return { ...card, recent_matches: recentMatches };
}
