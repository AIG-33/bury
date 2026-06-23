"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApplyToClubSchema, type JoinPolicy, type MemberRole, type MemberStatus } from "@/lib/clubs/schema";
import { hashInviteToken } from "@/lib/clubs/token";
import {
  clubPageBlocksFromRow,
  type ClubPageBlocks,
} from "@/lib/clubs/rating-schema";

// =============================================================================
// Types exposed to the UI
// =============================================================================

export type ClubListItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  district_name: string | null;
  join_policy: JoinPolicy;
  members_total: number;
  coaches_total: number;
  top5_avg_elo: number;
};

export type ClubDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  district_id: string | null;
  district_name: string | null;
  join_policy: JoinPolicy;
  owner_id: string;
  created_at: string;
  brand_color: string | null;
  cover_url: string | null;
  page_blocks: ClubPageBlocks;
};

export type ClubRosterEntry = {
  member_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number;
  is_coach: boolean;
  joined_at: string;
};

export type ClubVenueRef = {
  id: string;
  name: string;
  city: string | null;
  district_name: string | null;
};

export type ClubStats = {
  members_total: number;
  coaches_total: number;
  avg_elo: number;
  top5_avg_elo: number;
  active_30d: number;
  tournaments_total: number;
};

export type ClubViewerState = {
  authenticated: boolean;
  status: MemberStatus | null;
  role: MemberRole | null;
  is_primary: boolean;
  is_owner: boolean;
};

export type DistrictOption = {
  id: string;
  name: string;
  city: string;
};

type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

// =============================================================================
// Catalogue + detail loaders (anonymous-friendly)
// =============================================================================

/**
 * Public clubs catalogue. Sorted by top-5 avg Elo (DESC), ties broken by total
 * members (DESC) and creation date (DESC). City / district filters are pre-
 * applied at the DB level so the page stays fast even with thousands of clubs.
 */
export async function loadClubs(filter: {
  city?: string | null;
  districtId?: string | null;
}): Promise<ClubListItem[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("clubs")
    .select("id, slug, name, description, logo_url, city, district_id, join_policy, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (filter.city) {
    query = query.ilike("city", filter.city);
  }
  if (filter.districtId) {
    query = query.eq("district_id", filter.districtId);
  }

  const { data: rows } = (await query) as {
    data: Array<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      logo_url: string | null;
      city: string | null;
      district_id: string | null;
      join_policy: JoinPolicy;
      created_at: string;
    }> | null;
  };

  if (!rows || rows.length === 0) return [];

  const districtIds = Array.from(
    new Set(rows.map((r) => r.district_id).filter((x): x is string => Boolean(x))),
  );
  const districtNameById = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as { data: Array<{ id: string; name: string }> | null };
    for (const d of ds ?? []) districtNameById.set(d.id, d.name);
  }

  // Stats: one RPC per club is cheap (it's a single index scan over
  // club_members + a join). For >100 clubs we'd batch via a single SQL,
  // but the catalogue page is bounded so this is fine.
  const stats = await Promise.all(
    rows.map(async (r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = (await (supabase.rpc as any)("club_stats", { _club_id: r.id })) as {
        data:
          | Array<{
              members_total: number;
              coaches_total: number;
              top5_avg_elo: number;
            }>
          | null;
      };
      const s = data?.[0];
      return {
        id: r.id,
        members_total: s?.members_total ?? 0,
        coaches_total: s?.coaches_total ?? 0,
        top5_avg_elo: s?.top5_avg_elo ?? 0,
      };
    }),
  );
  const statsById = new Map(stats.map((s) => [s.id, s] as const));

  const enriched = rows.map((r) => {
    const s = statsById.get(r.id);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      logo_url: r.logo_url,
      city: r.city,
      district_name: r.district_id ? (districtNameById.get(r.district_id) ?? null) : null,
      join_policy: r.join_policy,
      members_total: s?.members_total ?? 0,
      coaches_total: s?.coaches_total ?? 0,
      top5_avg_elo: s?.top5_avg_elo ?? 0,
    };
  });

  // Sort: top-5 avg Elo desc, then members_total desc, then alpha by name.
  enriched.sort((a, b) => {
    if (b.top5_avg_elo !== a.top5_avg_elo) return b.top5_avg_elo - a.top5_avg_elo;
    if (b.members_total !== a.members_total) return b.members_total - a.members_total;
    return a.name.localeCompare(b.name);
  });

  return enriched;
}

export async function loadCityOptionsForClubs(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("clubs")
    .select("city")
    .not("city", "is", null)
    .order("city", { ascending: true })) as { data: Array<{ city: string }> | null };
  return Array.from(new Set((data ?? []).map((r) => r.city))).slice(0, 100);
}

export async function loadDistrictOptionsForClubs(): Promise<DistrictOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("districts")
    .select("id, name, city")
    .order("city", { ascending: true })
    .order("name", { ascending: true })) as {
    data: Array<{ id: string; name: string; city: string }> | null;
  };
  return data ?? [];
}

export async function loadClubBySlug(slug: string): Promise<
  | {
      ok: true;
      club: ClubDetail;
      stats: ClubStats;
      coaches: ClubRosterEntry[];
      players: ClubRosterEntry[];
      venues: ClubVenueRef[];
      viewer: ClubViewerState;
    }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();

  const { data: club } = (await supabase
    .from("clubs")
    .select(
      "id, slug, name, description, logo_url, city, district_id, join_policy, owner_id, created_at, brand_color, cover_url, page_blocks",
    )
    .eq("slug", slug)
    .maybeSingle()) as {
    data:
      | (Omit<ClubDetail, "district_name" | "page_blocks"> & {
          district_id: string | null;
          page_blocks: unknown;
        })
      | null;
  };

  if (!club) return { ok: false, error: "not_found" };

  let district_name: string | null = null;
  if (club.district_id) {
    const { data: d } = (await supabase
      .from("districts")
      .select("name")
      .eq("id", club.district_id)
      .maybeSingle()) as { data: { name: string } | null };
    district_name = d?.name ?? null;
  }

  // Stats via SECURITY DEFINER RPC.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: statsRows } = (await (supabase.rpc as any)("club_stats", { _club_id: club.id })) as {
    data:
      | Array<{
          members_total: number;
          coaches_total: number;
          avg_elo: number;
          top5_avg_elo: number;
          active_30d: number;
          tournaments_total: number;
        }>
      | null;
  };
  const stats: ClubStats = statsRows?.[0] ?? {
    members_total: 0,
    coaches_total: 0,
    avg_elo: 0,
    top5_avg_elo: 0,
    active_30d: 0,
    tournaments_total: 0,
  };

  // Roster: split into coaches + players. Approved-only rows are public per RLS.
  const { data: members } = (await supabase
    .from("club_members")
    .select("id, user_id, applied_at, decided_at")
    .eq("club_id", club.id)
    .eq("status", "approved")
    .order("decided_at", { ascending: false })
    .limit(500)) as {
    data: Array<{
      id: string;
      user_id: string;
      applied_at: string;
      decided_at: string | null;
    }> | null;
  };

  const memberIds = (members ?? []).map((m) => m.user_id);
  type Basic = {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    current_elo: number | null;
    is_coach: boolean;
  };
  let basicById = new Map<string, Basic>();
  if (memberIds.length > 0) {
    const { data: basics } = (await supabase
      .from("public_player_basic")
      .select("id, display_name, avatar_url, current_elo, is_coach")
      .in("id", memberIds)) as { data: Basic[] | null };
    basicById = new Map((basics ?? []).map((b) => [b.id, b] as const));
  }

  const allEntries: ClubRosterEntry[] = (members ?? []).map((m) => {
    const b = basicById.get(m.user_id);
    return {
      member_id: m.id,
      user_id: m.user_id,
      display_name: b?.display_name ?? null,
      avatar_url: b?.avatar_url ?? null,
      current_elo: b?.current_elo ?? 1000,
      is_coach: b?.is_coach ?? false,
      joined_at: m.decided_at ?? m.applied_at,
    };
  });

  const coaches = allEntries
    .filter((e) => e.is_coach)
    .sort((a, b) => b.current_elo - a.current_elo);
  const players = allEntries
    .filter((e) => !e.is_coach)
    .sort((a, b) => b.current_elo - a.current_elo);

  // Venues attached to the club.
  const { data: vs } = (await supabase
    .from("venues")
    .select("id, name, city, district_id")
    .eq("club_id", club.id)
    .order("name", { ascending: true })) as {
    data: Array<{
      id: string;
      name: string;
      city: string | null;
      district_id: string | null;
    }> | null;
  };
  const venueDistrictIds = Array.from(
    new Set((vs ?? []).map((v) => v.district_id).filter((x): x is string => Boolean(x))),
  );
  const venueDistrictNameById = new Map<string, string>();
  if (venueDistrictIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", venueDistrictIds)) as { data: Array<{ id: string; name: string }> | null };
    for (const d of ds ?? []) venueDistrictNameById.set(d.id, d.name);
  }
  const venues: ClubVenueRef[] = (vs ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    district_name: v.district_id ? (venueDistrictNameById.get(v.district_id) ?? null) : null,
  }));

  // Viewer state.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let viewer: ClubViewerState = {
    authenticated: !!user,
    status: null,
    role: null,
    is_primary: false,
    is_owner: false,
  };
  if (user) {
    const { data: own } = (await supabase
      .from("club_members")
      .select("status, role, is_primary")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .maybeSingle()) as {
      data: { status: MemberStatus; role: MemberRole; is_primary: boolean } | null;
    };
    viewer = {
      authenticated: true,
      status: own?.status ?? null,
      role: own?.role ?? null,
      is_primary: own?.is_primary ?? false,
      is_owner: club.owner_id === user.id,
    };
  }

  return {
    ok: true,
    club: {
      id: club.id,
      slug: club.slug,
      name: club.name,
      description: club.description,
      logo_url: club.logo_url,
      city: club.city,
      district_id: club.district_id,
      district_name,
      join_policy: club.join_policy,
      owner_id: club.owner_id,
      created_at: club.created_at,
      brand_color: club.brand_color,
      cover_url: club.cover_url,
      page_blocks: clubPageBlocksFromRow(club.page_blocks),
    },
    stats,
    coaches,
    players,
    venues,
    viewer,
  };
}

// =============================================================================
// Public club rating + tournaments (for the club page & /clubs/[slug]/rating)
// =============================================================================

export type ClubStandingRow = {
  player_id: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number;
  rating_status: "provisional" | "established";
  rated_matches_count: number;
  wins: number;
  losses: number;
};

export type ClubRatingBoard = {
  enabled: boolean;
  label: string | null;
  standings: ClubStandingRow[];
};

/** Public, read-only club standings (club_member_ratings is world-readable). */
export async function loadClubRatingBoard(clubId: string): Promise<ClubRatingBoard> {
  const supabase = await createSupabaseServerClient();

  const { data: settings } = (await supabase
    .from("club_rating_settings")
    .select("enabled, label")
    .eq("club_id", clubId)
    .maybeSingle()) as { data: { enabled: boolean; label: string | null } | null };

  const enabled = settings ? settings.enabled : true;
  if (!enabled) return { enabled: false, label: settings?.label ?? null, standings: [] };

  const { data: rows } = (await supabase
    .from("club_member_ratings")
    .select("player_id, rating, rating_status, rated_matches_count, wins, losses")
    .eq("club_id", clubId)
    .order("rating", { ascending: false })) as {
    data: Array<Omit<ClubStandingRow, "display_name" | "avatar_url">> | null;
  };
  const list = rows ?? [];
  if (list.length === 0) {
    return { enabled: true, label: settings?.label ?? null, standings: [] };
  }

  const { data: people } = (await supabase
    .from("public_player_basic")
    .select("id, display_name, avatar_url")
    .in(
      "id",
      list.map((r) => r.player_id),
    )) as {
    data: Array<{ id: string; display_name: string | null; avatar_url: string | null }> | null;
  };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  return {
    enabled: true,
    label: settings?.label ?? null,
    standings: list.map((r) => ({
      ...r,
      display_name: byId.get(r.player_id)?.display_name ?? null,
      avatar_url: byId.get(r.player_id)?.avatar_url ?? null,
    })),
  };
}

export type ClubTournamentRow = {
  id: string;
  name: string;
  status: string;
  format: string;
  starts_on: string;
  privacy: string;
};

/** Public tournaments linked to a club (drafts/club-private hidden from outsiders). */
export async function loadClubTournaments(clubId: string): Promise<ClubTournamentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("tournaments")
    .select("id, name, status, format, starts_on, privacy")
    .eq("club_id", clubId)
    .neq("status", "draft")
    .order("starts_on", { ascending: false })
    .limit(50)) as { data: ClubTournamentRow[] | null };
  return data ?? [];
}

// =============================================================================
// User-side actions
// =============================================================================

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  return { ok: true as const, supabase, userId: user.id };
}

/**
 * Apply to join a club. Behaviour depends on the club's `join_policy`:
 *   - `approval` (default): row inserted with status='pending', owner decides.
 *   - `open`               : row inserted with status='approved' immediately.
 *   - `closed`             : rejected; the only way in is the invite link
 *                             (joinViaToken) or owner-side AddMember.
 */
export async function applyToJoinClub(input: unknown): Promise<ActionResult<{ status: MemberStatus }>> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = ApplyToClubSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  const { data: club } = (await supabase
    .from("clubs")
    .select("id, slug, join_policy")
    .eq("id", v.club_id)
    .maybeSingle()) as {
    data: { id: string; slug: string; join_policy: JoinPolicy } | null;
  };
  if (!club) return { ok: false, error: "club_not_found" };

  if (club.join_policy === "closed") {
    return { ok: false, error: "club_closed" };
  }

  const targetStatus: MemberStatus =
    club.join_policy === "open" ? "approved" : "pending";

  // Detect existing row (any status) to decide insert vs update.
  const { data: existing } = (await supabase
    .from("club_members")
    .select("id, status")
    .eq("club_id", v.club_id)
    .eq("user_id", userId)
    .maybeSingle()) as { data: { id: string; status: MemberStatus } | null };

  if (existing) {
    if (existing.status === "approved" || existing.status === "pending") {
      return { ok: false, error: "already_member" };
    }
    // Rejected → reapply by transitioning the existing row back to pending.
    // This requires admin-side approval — covered by the trigger because the
    // user is not allowed to flip status themselves; so we go through the
    // service client here (rejected-row reapplication is a controlled action
    // that bypasses the self-update guard).
    const { error: upErr } = await (supabase as unknown as {
      from(t: string): {
        update(values: Record<string, unknown>): {
          eq(col: string, val: string): Promise<{ error: { message: string } | null }>;
        };
      };
    })
      .from("club_members")
      .update({
        status: targetStatus,
        message: v.message,
        applied_at: new Date().toISOString(),
        decided_at: null,
        decided_by: null,
      })
      .eq("id", existing.id);
    if (upErr) return { ok: false, error: upErr.message };
  } else {
    const { error: insErr } = await supabase
      .from("club_members")
      .insert({
        club_id: v.club_id,
        user_id: userId,
        status: targetStatus,
        role: "member",
        is_primary: false,
        message: v.message,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/me/clubs");
  return { ok: true, data: { status: targetStatus } };
}

/**
 * Accept a closed-club invite via the multi-use link `/clubs/join/<token>`.
 * Delegates to the SECURITY DEFINER function `public.accept_club_invite` —
 * the only path that may write status='approved' for a `closed` club.
 */
export async function joinViaToken(token: string): Promise<
  ActionResult<{ club_id: string; slug: string }>
> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const tokenHash = hashInviteToken(token);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase.rpc as any)("accept_club_invite", {
    _token_hash: tokenHash,
  })) as {
    data: Array<{ club_id: string; member_id: string }> | null;
    error: { message: string; code?: string } | null;
  };
  if (error) {
    // Map known custom errors to UI-friendly codes.
    if (error.message.includes("invite_invalid")) return { ok: false, error: "invite_invalid" };
    if (error.message.includes("invite_expired")) return { ok: false, error: "invite_expired" };
    return { ok: false, error: error.message };
  }
  const row = data?.[0];
  if (!row) return { ok: false, error: "invite_invalid" };

  const { data: club } = (await supabase
    .from("clubs")
    .select("slug")
    .eq("id", row.club_id)
    .maybeSingle()) as { data: { slug: string } | null };
  if (!club) return { ok: false, error: "club_not_found" };

  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/me/clubs");
  return { ok: true, data: { club_id: row.club_id, slug: club.slug } };
}

/**
 * User leaves a club — deletes the user's row (any status).
 */
export async function leaveClub(clubId: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/clubs");
  return { ok: true };
}

/**
 * Mark a membership as the user's primary club. Internally:
 *   1) Clear `is_primary` on every other approved row of the user.
 *   2) Set `is_primary = true` on the target row.
 * The partial unique index `club_members_one_primary_per_user` guarantees
 * the invariant even under races.
 *
 * Passing `clubId = null` clears the primary flag everywhere.
 */
export async function setPrimaryClub(clubId: string | null): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  // Step 1: clear all primaries for this user.
  const { error: clearErr } = await supabase
    .from("club_members")
    .update({ is_primary: false } as never)
    .eq("user_id", userId)
    .eq("is_primary", true);
  if (clearErr) return { ok: false, error: clearErr.message };

  if (!clubId) {
    revalidatePath("/me/clubs");
    return { ok: true };
  }

  // Step 2: set the new primary. The row must exist and be approved — we
  // filter on both to avoid promoting a pending application.
  const { error: setErr, count } = await supabase
    .from("club_members")
    .update({ is_primary: true } as never, { count: "exact" })
    .eq("user_id", userId)
    .eq("club_id", clubId)
    .eq("status", "approved");
  if (setErr) return { ok: false, error: setErr.message };
  if ((count ?? 0) === 0) return { ok: false, error: "membership_not_approved" };

  revalidatePath("/me/clubs");
  return { ok: true };
}

/**
 * Cancel a pending application made by the current user.
 */
export async function cancelMyApplication(clubId: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/clubs");
  return { ok: true };
}
