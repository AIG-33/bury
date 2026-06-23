"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  ClubPageSettingsSchema,
  ClubRatingSettingsSchema,
  AdjustClubRatingSchema,
  ClubRatingConfigSchema,
  DEFAULT_CLUB_RATING_CONFIG,
  DEFAULT_CLUB_PAGE_BLOCKS,
  clubRatingConfigFromRow,
  clubRatingConfigToRatingConfig,
  clubPageBlocksFromRow,
  type ClubRatingConfig,
  type ClubPageBlocks,
} from "@/lib/clubs/rating-schema";
import { computeMatchEloDelta, eloStatusFor, type MatchKind } from "@/lib/rating/elo";

type Result<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireClubAdmin(clubId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };

  const { data: club } = (await supabase
    .from("clubs")
    .select("id, slug, owner_id")
    .eq("id", clubId)
    .maybeSingle()) as { data: { id: string; slug: string; owner_id: string } | null };
  if (!club) return { ok: false as const, error: "not_found" as const };

  let isAdmin = club.owner_id === user.id;
  if (!isAdmin) {
    const { data: cm } = (await supabase
      .from("club_members")
      .select("role, status")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .maybeSingle()) as { data: { role: string; status: string } | null };
    isAdmin = cm?.role === "admin" && cm?.status === "approved";
  }
  if (!isAdmin) return { ok: false as const, error: "not_owner" as const };

  return { ok: true as const, supabase, userId: user.id, club };
}

// ─── Loaders ──────────────────────────────────────────────────────────────────

export type ClubRatingSettingsData = {
  enabled: boolean;
  label: string | null;
  config: ClubRatingConfig;
};

export type ClubPageSettingsData = {
  brand_color: string | null;
  cover_url: string | null;
  blocks: ClubPageBlocks;
};

export type ClubRatingStandingRow = {
  player_id: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number;
  rating_status: "provisional" | "established";
  rated_matches_count: number;
  wins: number;
  losses: number;
};

export async function loadClubRatingSettings(
  clubId: string,
): Promise<ClubRatingSettingsData> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("club_rating_settings")
    .select("enabled, label, config")
    .eq("club_id", clubId)
    .maybeSingle()) as {
    data: { enabled: boolean; label: string | null; config: unknown } | null;
  };
  return {
    enabled: data ? data.enabled : true,
    label: data?.label ?? null,
    config: clubRatingConfigFromRow(data?.config),
  };
}

export async function loadClubPageSettings(
  clubId: string,
): Promise<ClubPageSettingsData> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("clubs")
    .select("brand_color, cover_url, page_blocks")
    .eq("id", clubId)
    .maybeSingle()) as {
    data: { brand_color: string | null; cover_url: string | null; page_blocks: unknown } | null;
  };
  return {
    brand_color: data?.brand_color ?? null,
    cover_url: data?.cover_url ?? null,
    blocks: clubPageBlocksFromRow(data?.page_blocks),
  };
}

export async function loadClubStandings(
  clubId: string,
): Promise<ClubRatingStandingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data: rows } = (await supabase
    .from("club_member_ratings")
    .select("player_id, rating, rating_status, rated_matches_count, wins, losses")
    .eq("club_id", clubId)
    .order("rating", { ascending: false })) as {
    data: Array<{
      player_id: string;
      rating: number;
      rating_status: "provisional" | "established";
      rated_matches_count: number;
      wins: number;
      losses: number;
    }> | null;
  };
  const list = rows ?? [];
  if (list.length === 0) return [];

  const { data: people } = (await supabase
    .from("public_player_basic")
    .select("id, display_name, avatar_url")
    .in("id", list.map((r) => r.player_id))) as {
    data: Array<{ id: string; display_name: string | null; avatar_url: string | null }> | null;
  };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  return list.map((r) => ({
    player_id: r.player_id,
    display_name: byId.get(r.player_id)?.display_name ?? null,
    avatar_url: byId.get(r.player_id)?.avatar_url ?? null,
    rating: r.rating,
    rating_status: r.rating_status,
    rated_matches_count: r.rated_matches_count,
    wins: r.wins,
    losses: r.losses,
  }));
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updateClubPageSettings(input: unknown): Promise<Result> {
  const parsed = ClubPageSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;
  const auth = await requireClubAdmin(v.club_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("clubs")
    .update({
      brand_color: v.brand_color,
      cover_url: v.cover_url,
      page_blocks: v.blocks ?? DEFAULT_CLUB_PAGE_BLOCKS,
    } as never)
    .eq("id", v.club_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clubs/${auth.club.slug}`);
  revalidatePath(`/me/clubs/owned/${v.club_id}`);
  return { ok: true };
}

export async function updateClubRatingSettings(input: unknown): Promise<Result> {
  const parsed = ClubRatingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;
  const auth = await requireClubAdmin(v.club_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("club_rating_settings")
    .upsert(
      {
        club_id: v.club_id,
        enabled: v.enabled,
        label: v.label,
        config: v.config,
      } as never,
      { onConflict: "club_id" } as never,
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clubs/${auth.club.slug}`);
  revalidatePath(`/clubs/${auth.club.slug}/rating`);
  revalidatePath(`/me/clubs/owned/${v.club_id}`);
  return { ok: true };
}

/**
 * Owner manually sets a player's club rating to an absolute value, logging the
 * change. Uses the service role to write the rating tables (which deny
 * non-admin writes) AFTER verifying the caller administers the club.
 */
export async function adjustClubRating(input: unknown): Promise<Result> {
  const parsed = AdjustClubRatingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;
  const auth = await requireClubAdmin(v.club_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  const service = createSupabaseServiceClient();
  const settings = await loadClubRatingSettings(v.club_id);
  const cfg = clubRatingConfigToRatingConfig(settings.config);

  const { data: existing } = (await service
    .from("club_member_ratings")
    .select("rating, rated_matches_count, wins, losses")
    .eq("club_id", v.club_id)
    .eq("player_id", v.player_id)
    .maybeSingle()) as {
    data: { rating: number; rated_matches_count: number; wins: number; losses: number } | null;
  };
  const old = existing ?? {
    rating: settings.config.start_rating,
    rated_matches_count: 0,
    wins: 0,
    losses: 0,
  };

  const { error: upErr } = await service.from("club_member_ratings").upsert(
    {
      club_id: v.club_id,
      player_id: v.player_id,
      rating: v.new_rating,
      rating_status: eloStatusFor(old.rated_matches_count, cfg),
      rated_matches_count: old.rated_matches_count,
      wins: old.wins,
      losses: old.losses,
    } as never,
    { onConflict: "club_id,player_id" } as never,
  );
  if (upErr) return { ok: false, error: upErr.message };

  const { error: histErr } = await service.from("club_rating_history").insert({
    club_id: v.club_id,
    player_id: v.player_id,
    match_id: null,
    old_rating: old.rating,
    new_rating: v.new_rating,
    reason: "manual_adjustment",
    note: v.note,
    created_by: auth.userId,
  } as never);
  if (histErr) return { ok: false, error: histErr.message };

  revalidatePath(`/clubs/${auth.club.slug}/rating`);
  revalidatePath(`/me/clubs/owned/${v.club_id}`);
  return { ok: true };
}

/** Pure preview for the owner's rating editor (no DB writes). */
export async function simulateClubMatch(input: {
  config: unknown;
  p1Rating: number;
  p2Rating: number;
  p1Matches: number;
  p2Matches: number;
  winnerSide: "p1" | "p2";
  kind: MatchKind;
}): Promise<Result<{ p1Delta: number; p2Delta: number; p1New: number; p2New: number }>> {
  const parsed = ClubRatingConfigSchema.safeParse(input.config);
  const cfg = clubRatingConfigToRatingConfig(parsed.success ? parsed.data : DEFAULT_CLUB_RATING_CONFIG);
  const u = computeMatchEloDelta({
    p1Elo: input.p1Rating,
    p2Elo: input.p2Rating,
    p1Matches: input.p1Matches,
    p2Matches: input.p2Matches,
    winnerSide: input.winnerSide,
    kind: input.kind,
    cfg,
  });
  return {
    ok: true,
    data: { p1Delta: u.p1Delta, p2Delta: u.p2Delta, p1New: u.p1NewElo, p2New: u.p2NewElo },
  };
}
