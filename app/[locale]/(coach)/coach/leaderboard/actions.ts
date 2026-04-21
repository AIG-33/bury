"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Coach leaderboard data loader.
//
// Strategy:
//   1. Find the union of players who interacted with this coach:
//        – have a confirmed booking on any of the coach's slots
//        – are a participant in any of the coach's tournaments
//   2. Fall back to "all visible players" when the coach has no relations yet
//      (so a freshly-created coach still sees a useful page).
//   3. Sort by current_elo desc, attach deltas (7d / 30d) and matches counts.
// =============================================================================

export type LeaderboardRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number;
  elo_status: "provisional" | "established";
  rated_matches_count: number;
  city: string | null;
  district_name: string | null;
  delta_7d: number;
  delta_30d: number;
  is_my_player: boolean; // true if connected to me via booking/tournament
};

export type LeaderboardResult =
  | {
      ok: true;
      rows: LeaderboardRow[];
      total_my_players: number;
      total_directory: number;
    }
  | { ok: false; error: string };

async function requireCoach() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  const { data: profile } = (await supabase
    .from("profiles")
    .select("id, is_coach, is_admin")
    .eq("id", user.id)
    .single()) as {
    data: { id: string; is_coach: boolean; is_admin: boolean } | null;
  };
  if (!profile) return { ok: false as const, error: "no_profile" as const };
  if (!profile.is_coach && !profile.is_admin) {
    return { ok: false as const, error: "not_a_coach" as const };
  }
  return { ok: true as const, supabase, userId: profile.id };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadCoachLeaderboard(opts: {
  scope: "mine" | "all";
  limit?: number;
}): Promise<LeaderboardResult> {
  const auth = await requireCoach();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;
  const limit = Math.min(opts.limit ?? 100, 200);

  // -- 1) Players from my bookings (via my courts → my venues) --------------
  const { data: myVenues } = (await supabase
    .from("venues")
    .select("id")
    .eq("owner_id", userId)) as { data: Array<{ id: string }> | null };
  const venueIds = (myVenues ?? []).map((v) => v.id);

  const courtIds: string[] = [];
  if (venueIds.length > 0) {
    const { data: cs } = (await supabase
      .from("courts")
      .select("id")
      .in("venue_id", venueIds)) as { data: Array<{ id: string }> | null };
    for (const c of cs ?? []) courtIds.push(c.id);
  }

  const myPlayerIds = new Set<string>();
  if (courtIds.length > 0) {
    const { data: slotIds } = (await supabase
      .from("slots")
      .select("id")
      .in("court_id", courtIds)) as { data: Array<{ id: string }> | null };
    const sIds = (slotIds ?? []).map((s) => s.id);
    if (sIds.length > 0) {
      const { data: bks } = (await supabase
        .from("bookings")
        .select("player_id")
        .in("slot_id", sIds)
        .in("status", ["confirmed", "attended", "pending"])) as {
        data: Array<{ player_id: string }> | null;
      };
      for (const b of bks ?? []) myPlayerIds.add(b.player_id);
    }
  }

  // -- 2) Players from my tournaments --------------------------------------
  const { data: myTours } = (await supabase
    .from("tournaments")
    .select("id")
    .eq("owner_coach_id", userId)) as { data: Array<{ id: string }> | null };
  const tourIds = (myTours ?? []).map((t) => t.id);
  if (tourIds.length > 0) {
    const { data: tps } = (await supabase
      .from("tournament_participants")
      .select("player_id")
      .in("tournament_id", tourIds)) as {
      data: Array<{ player_id: string }> | null;
    };
    for (const tp of tps ?? []) myPlayerIds.add(tp.player_id);
  }

  // -- 3) Build the candidate id set depending on scope ---------------------
  // Always exclude the coach themselves from the leaderboard.
  myPlayerIds.delete(userId);

  let candidateIds: string[] | null = null; // null = "no filter, all visible"
  if (opts.scope === "mine") {
    candidateIds = Array.from(myPlayerIds);
    if (candidateIds.length === 0) {
      return {
        ok: true,
        rows: [],
        total_my_players: 0,
        total_directory: 0,
      };
    }
  }

  // -- 4) Load profiles + districts ----------------------------------------
  let q = supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, current_elo, elo_status, rated_matches_count, city, " +
        "districts(name)",
    )
    .eq("visible_in_leaderboard", true)
    .neq("id", userId)
    .order("current_elo", { ascending: false })
    .limit(limit);
  if (candidateIds) q = q.in("id", candidateIds);

  const { data: rawProfiles } = (await q) as {
    data: Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      current_elo: number;
      elo_status: "provisional" | "established";
      rated_matches_count: number;
      city: string | null;
      districts: { name: string | null } | null;
    }> | null;
  };

  const profiles = rawProfiles ?? [];
  const profileIds = profiles.map((p) => p.id);

  // -- 5) Recent rating history for deltas ---------------------------------
  const sinceIso = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const deltas7 = new Map<string, number>();
  const deltas30 = new Map<string, number>();
  if (profileIds.length > 0) {
    const { data: hist } = (await supabase
      .from("rating_history")
      .select("player_id, delta, created_at")
      .in("player_id", profileIds)
      .gte("created_at", sinceIso)) as {
      data: Array<{
        player_id: string;
        delta: number;
        created_at: string;
      }> | null;
    };
    const sevenDaysAgo = Date.now() - 7 * DAY_MS;
    for (const h of hist ?? []) {
      deltas30.set(h.player_id, (deltas30.get(h.player_id) ?? 0) + h.delta);
      if (Date.parse(h.created_at) >= sevenDaysAgo) {
        deltas7.set(h.player_id, (deltas7.get(h.player_id) ?? 0) + h.delta);
      }
    }
  }

  const rows: LeaderboardRow[] = profiles.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    current_elo: p.current_elo,
    elo_status: p.elo_status,
    rated_matches_count: p.rated_matches_count,
    city: p.city,
    district_name: p.districts?.name ?? null,
    delta_7d: deltas7.get(p.id) ?? 0,
    delta_30d: deltas30.get(p.id) ?? 0,
    is_my_player: myPlayerIds.has(p.id),
  }));

  // -- 6) Tally directory size for the scope tabs --------------------------
  const { count: total } = (await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("visible_in_leaderboard", true)
    .neq("id", userId)) as { count: number | null };

  return {
    ok: true,
    rows,
    total_my_players: myPlayerIds.size,
    total_directory: total ?? 0,
  };
}
