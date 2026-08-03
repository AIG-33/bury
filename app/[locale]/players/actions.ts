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
  type PublicPlayerStats,
} from "@/lib/players/public-card";
import { isValidCountryCode } from "@/lib/geo/countries";
import { LEVEL_BUCKETS, LEVEL_RANGES } from "./filters";

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
// Public players catalogue (`/players` — indexable, no auth required).
//
// Reads the RLS-bypassing `public_player_directory` view (see migrations
// `20260511010000_public_player_directory.sql` and
// `20260719000000_restore_public_player_directory_anon.sql`) — never from
// `profiles` directly — so we cannot accidentally leak phone numbers, social
// links, emails, or other PII. Pure card-mapping lives in
// `lib/players/public-card.ts` for unit tests without Supabase.
//
// Authenticated users still get the richer `/me/find` flow (availability
// overlap + pending-proposal exclusion) when proposing a match.
// =============================================================================

// =============================================================================
// Filter schema
// =============================================================================

const PublicFiltersSchema = z.object({
  country: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v): string | null => (v && isValidCountryCode(v) ? v : null)),
  level: z.enum(LEVEL_BUCKETS).default("any"),
  /** Which ladder drives the level filter, sort order and the big number. */
  discipline: z.enum(["singles", "doubles"]).default("singles"),
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
// Main loader
// =============================================================================

const PAGE_LIMIT = 60;

export async function loadPublicPlayers(input: PublicFiltersInput): Promise<PublicPlayersResult> {
  const filters = PublicFiltersSchema.parse(input);
  const range = LEVEL_RANGES[filters.level];

  const supabase = await createSupabaseServerClient();

  // The active discipline decides which Elo column filters/sorts the list.
  const eloColumn =
    filters.discipline === "doubles" ? "current_elo_doubles" : "current_elo";

  let q = supabase
    .from("public_player_directory")
    .select(
      "id, display_name, avatar_url, city, country, current_elo, elo_status, " +
        "rated_matches_count, current_elo_doubles, elo_status_doubles, " +
        "rated_matches_count_doubles, dominant_hand, backhand_style, " +
        "favorite_surface, availability, last_match_at, is_coach",
    )
    .gte(eloColumn, range.min)
    .lte(eloColumn, range.max)
    .order(eloColumn, { ascending: false })
    .limit(PAGE_LIMIT + 1);

  if (filters.country) q = q.eq("country", filters.country);
  if (filters.hand !== "both") q = q.eq("dominant_hand", filters.hand);

  const { data: rows } = (await q) as { data: PublicDirectoryRow[] | null };

  const all = rows ?? [];

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

  // W/L aggregates from the `player_match_stats` view — single round-trip
  // for the whole page so cards can render "7W–3L · 70%" without N+1 queries.
  const statsByPlayer = new Map<string, PublicPlayerStats>();
  if (ids.length > 0) {
    const { data: stats } = (await supabase
      .from("player_match_stats")
      .select("player_id, completed_count, wins_count, losses_count")
      .in("player_id", ids)) as {
      data: Array<{
        player_id: string;
        completed_count: number;
        wins_count: number;
        losses_count: number;
      }> | null;
    };
    for (const s of stats ?? []) {
      statsByPlayer.set(s.player_id, {
        completed_count: s.completed_count ?? 0,
        wins_count: s.wins_count ?? 0,
        losses_count: s.losses_count ?? 0,
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
      now,
      statsByPlayer.get(row.id) ?? undefined,
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
      "id, display_name, avatar_url, city, country, current_elo, elo_status, " +
        "rated_matches_count, current_elo_doubles, elo_status_doubles, " +
        "rated_matches_count_doubles, dominant_hand, backhand_style, " +
        "favorite_surface, availability, last_match_at, is_coach",
    )
    .eq("id", playerId)
    .maybeSingle()) as { data: PublicDirectoryRow | null };

  if (!row) return null;

  const [externalRating, stats, recentMatches] = await Promise.all([
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
    (async (): Promise<PublicPlayerStats | undefined> => {
      const { data } = (await supabase
        .from("player_match_stats")
        .select("completed_count, wins_count, losses_count")
        .eq("player_id", row.id)
        .maybeSingle()) as {
        data: {
          completed_count: number;
          wins_count: number;
          losses_count: number;
        } | null;
      };
      if (!data) return undefined;
      return {
        completed_count: data.completed_count ?? 0,
        wins_count: data.wins_count ?? 0,
        losses_count: data.losses_count ?? 0,
      };
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

  const card = toPublicPlayerCard(row, externalRating, Date.now(), stats);

  return { ...card, recent_matches: recentMatches };
}

// =============================================================================
// Player clubs + per-club internal ratings (public profile section).
//
// Everything read here is world-readable per RLS: approved club_members rows,
// clubs, and club_member_ratings (the club standings are public pages).
// =============================================================================

export type PlayerClubEntry = {
  club_id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  is_primary: boolean;
  /** Internal club rating per ladder; null while the player is unrated there. */
  rating_singles: number | null;
  rating_singles_status: "provisional" | "established" | null;
  rating_doubles: number | null;
  rating_doubles_status: "provisional" | "established" | null;
};

export async function loadPlayerClubs(playerId: string): Promise<PlayerClubEntry[]> {
  const supabase = await createSupabaseServerClient();

  const { data: memberships } = (await supabase
    .from("club_members")
    .select("club_id, is_primary")
    .eq("user_id", playerId)
    .eq("status", "approved")) as {
    data: Array<{ club_id: string; is_primary: boolean }> | null;
  };
  if (!memberships || memberships.length === 0) return [];

  const clubIds = memberships.map((m) => m.club_id);
  const [{ data: clubs }, { data: ratings }] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, slug, name, logo_url")
      .in("id", clubIds) as unknown as Promise<{
      data: Array<{ id: string; slug: string; name: string; logo_url: string | null }> | null;
    }>,
    supabase
      .from("club_member_ratings")
      .select("club_id, discipline, rating, rating_status")
      .eq("player_id", playerId)
      .in("club_id", clubIds) as unknown as Promise<{
      data: Array<{
        club_id: string;
        discipline: "singles" | "doubles";
        rating: number;
        rating_status: "provisional" | "established";
      }> | null;
    }>,
  ]);

  const clubById = new Map((clubs ?? []).map((c) => [c.id, c] as const));
  const ratingByClubDiscipline = new Map(
    (ratings ?? []).map((r) => [`${r.club_id}:${r.discipline}`, r] as const),
  );

  const entries: PlayerClubEntry[] = [];
  for (const m of memberships) {
    const club = clubById.get(m.club_id);
    if (!club) continue;
    const singles = ratingByClubDiscipline.get(`${m.club_id}:singles`) ?? null;
    const doubles = ratingByClubDiscipline.get(`${m.club_id}:doubles`) ?? null;
    entries.push({
      club_id: club.id,
      slug: club.slug,
      name: club.name,
      logo_url: club.logo_url,
      is_primary: m.is_primary,
      rating_singles: singles?.rating ?? null,
      rating_singles_status: singles?.rating_status ?? null,
      rating_doubles: doubles?.rating ?? null,
      rating_doubles_status: doubles?.rating_status ?? null,
    });
  }

  // Primary club first, then alphabetically.
  entries.sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}
