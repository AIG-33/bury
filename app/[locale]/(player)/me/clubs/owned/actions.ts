"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications/notify";
import {
  ClubFormSchema,
  DecideApplicationSchema,
  SetMemberRoleSchema,
  AddMemberSchema,
  InviteTokenSchema,
  ProposeOwnershipSchema,
  type JoinPolicy,
  type MemberRole,
  type MemberStatus,
} from "@/lib/clubs/schema";
import { nameToSlug, dedupeSlug } from "@/lib/clubs/slug";
import { generateInviteToken } from "@/lib/clubs/token";

// =============================================================================
// Types
// =============================================================================

export type OwnedClubRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  join_policy: JoinPolicy;
  members_total: number;
  pending_count: number;
  is_owner: boolean;
  is_admin: boolean;
  pending_owner_id: string | null;
};

export type OwnedClubDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  country: string;
  join_policy: JoinPolicy;
  hide_owner: boolean;
  invite_token_present: boolean;
  invite_expires_at: string | null;
  pending_owner_id: string | null;
  pending_owner_name: string | null;
  pending_owner_at: string | null;
  owner_id: string;
  owner_name: string | null;
  is_owner: boolean;
  created_at: string;
};

export type ApplicationRow = {
  member_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number;
  city: string | null;
  is_coach: boolean;
  message: string | null;
  applied_at: string;
};

export type MemberRow = {
  member_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number;
  is_coach: boolean;
  role: MemberRole;
  is_primary: boolean;
  joined_at: string;
};

type SaveResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

// =============================================================================
// Auth
// =============================================================================

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  return { ok: true as const, supabase, userId: user.id };
}

async function requireClubAdmin(clubId: string) {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: club } = (await supabase
    .from("clubs")
    .select("id, slug, name, owner_id")
    .eq("id", clubId)
    .maybeSingle()) as {
    data: { id: string; slug: string; name: string; owner_id: string } | null;
  };
  if (!club) return { ok: false as const, error: "not_found" as const };

  const isOwner = club.owner_id === userId;
  let isAdmin = isOwner;
  if (!isOwner) {
    const { data: cm } = (await supabase
      .from("club_members")
      .select("role, status")
      .eq("club_id", clubId)
      .eq("user_id", userId)
      .maybeSingle()) as { data: { role: MemberRole; status: MemberStatus } | null };
    isAdmin = cm?.role === "admin" && cm?.status === "approved";
  }
  if (!isAdmin) return { ok: false as const, error: "not_owner" as const };

  return { ok: true as const, supabase, userId, club, isOwner };
}

// =============================================================================
// Loaders
// =============================================================================

/**
 * Clubs the current user owns OR is a co-admin of. Includes admin-side
 * counters (total members + pending applications).
 */
export async function loadOwnedClubs(): Promise<
  { ok: true; clubs: OwnedClubRow[] } | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  // Clubs I own + clubs where I'm an approved admin (two queries → merge).
  const [ownedRes, adminMembershipsRes] = await Promise.all([
    supabase
      .from("clubs")
      .select(
        "id, slug, name, description, logo_url, city, join_policy, pending_owner_id, created_at",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .eq("status", "approved"),
  ]);

  type Row = {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    city: string | null;
    join_policy: JoinPolicy;
    pending_owner_id: string | null;
    created_at: string;
  };

  const ownedRows = (ownedRes.data ?? []) as Array<Row>;
  const ownedIds = new Set(ownedRows.map((r) => r.id));

  let adminRows: Row[] = [];
  const adminClubIds = ((adminMembershipsRes.data ?? []) as Array<{ club_id: string }>)
    .map((r) => r.club_id)
    .filter((id) => !ownedIds.has(id));
  if (adminClubIds.length > 0) {
    const { data: more } = (await supabase
      .from("clubs")
      .select(
        "id, slug, name, description, logo_url, city, join_policy, pending_owner_id, created_at",
      )
      .in("id", adminClubIds)) as { data: Row[] | null };
    adminRows = more ?? [];
  }

  const allRows: Array<Row & { is_owner: boolean }> = [
    ...ownedRows.map((r) => ({ ...r, is_owner: true })),
    ...adminRows.map((r) => ({ ...r, is_owner: false })),
  ];

  if (allRows.length === 0) return { ok: true, clubs: [] };

  // Counts (approved + pending) per club — fast aggregate.
  const ids = allRows.map((r) => r.id);
  const { data: cmRows } = (await supabase
    .from("club_members")
    .select("club_id, status")
    .in("club_id", ids)) as {
    data: Array<{ club_id: string; status: MemberStatus }> | null;
  };
  const approvedCount = new Map<string, number>();
  const pendingCount = new Map<string, number>();
  for (const r of cmRows ?? []) {
    if (r.status === "approved") {
      approvedCount.set(r.club_id, (approvedCount.get(r.club_id) ?? 0) + 1);
    } else if (r.status === "pending") {
      pendingCount.set(r.club_id, (pendingCount.get(r.club_id) ?? 0) + 1);
    }
  }

  return {
    ok: true,
    clubs: allRows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      logo_url: r.logo_url,
      city: r.city,
      join_policy: r.join_policy,
      members_total: approvedCount.get(r.id) ?? 0,
      pending_count: pendingCount.get(r.id) ?? 0,
      is_owner: r.is_owner,
      is_admin: true, // by construction
      pending_owner_id: r.pending_owner_id,
    })),
  };
}

export async function loadOwnedClubDetail(
  clubId: string,
): Promise<
  | {
      ok: true;
      club: OwnedClubDetail;
      pending: ApplicationRow[];
      members: MemberRow[];
    }
  | { ok: false; error: string }
> {
  const guard = await requireClubAdmin(clubId);
  if (!guard.ok) return guard;
  const { supabase } = guard;

  const { data: full } = (await supabase
    .from("clubs")
    .select(
      "id, slug, name, description, logo_url, city, country, join_policy, hide_owner, " +
        "invite_token_hash, invite_expires_at, pending_owner_id, pending_owner_at, " +
        "owner_id, created_at",
    )
    .eq("id", clubId)
    .single()) as {
    data: {
      id: string;
      slug: string;
      name: string;
      description: string | null;
      logo_url: string | null;
      city: string | null;
      country: string;
      join_policy: JoinPolicy;
      hide_owner: boolean;
      invite_token_hash: string | null;
      invite_expires_at: string | null;
      pending_owner_id: string | null;
      pending_owner_at: string | null;
      owner_id: string;
      created_at: string;
    } | null;
  };
  if (!full) return { ok: false, error: "not_found" };

  // Resolve owner/pending-owner display names from the public projection.
  const idsToResolve = Array.from(
    new Set([full.owner_id, full.pending_owner_id].filter((x): x is string => Boolean(x))),
  );
  const nameById = new Map<string, string | null>();
  if (idsToResolve.length > 0) {
    const { data: basics } = (await supabase
      .from("public_player_basic")
      .select("id, display_name")
      .in("id", idsToResolve)) as {
      data: Array<{ id: string; display_name: string | null }> | null;
    };
    for (const b of basics ?? []) nameById.set(b.id, b.display_name);
  }

  const { data: members } = (await supabase
    .from("club_members")
    .select("id, user_id, role, is_primary, status, message, applied_at, decided_at")
    .eq("club_id", clubId)
    .order("status", { ascending: true })
    .order("applied_at", { ascending: false })) as {
    data: Array<{
      id: string;
      user_id: string;
      role: MemberRole;
      is_primary: boolean;
      status: MemberStatus;
      message: string | null;
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
    city: string | null;
    is_coach: boolean;
  };
  let basicById = new Map<string, Basic>();
  if (memberIds.length > 0) {
    const { data: basics } = (await supabase
      .from("public_player_basic")
      .select("id, display_name, avatar_url, current_elo, city, is_coach")
      .in("id", memberIds)) as { data: Basic[] | null };
    basicById = new Map((basics ?? []).map((b) => [b.id, b] as const));
  }

  const pending: ApplicationRow[] = [];
  const memberList: MemberRow[] = [];
  for (const m of members ?? []) {
    const b = basicById.get(m.user_id);
    if (m.status === "pending") {
      pending.push({
        member_id: m.id,
        user_id: m.user_id,
        display_name: b?.display_name ?? null,
        avatar_url: b?.avatar_url ?? null,
        current_elo: b?.current_elo ?? 1000,
        city: b?.city ?? null,
        is_coach: b?.is_coach ?? false,
        message: m.message,
        applied_at: m.applied_at,
      });
    } else if (m.status === "approved") {
      memberList.push({
        member_id: m.id,
        user_id: m.user_id,
        display_name: b?.display_name ?? null,
        avatar_url: b?.avatar_url ?? null,
        current_elo: b?.current_elo ?? 1000,
        is_coach: b?.is_coach ?? false,
        role: m.role,
        is_primary: m.is_primary,
        joined_at: m.decided_at ?? m.applied_at,
      });
    }
  }

  return {
    ok: true,
    club: {
      id: full.id,
      slug: full.slug,
      name: full.name,
      description: full.description,
      logo_url: full.logo_url,
      city: full.city,
      country: full.country,
      join_policy: full.join_policy,
      hide_owner: full.hide_owner,
      invite_token_present: !!full.invite_token_hash,
      invite_expires_at: full.invite_expires_at,
      pending_owner_id: full.pending_owner_id,
      pending_owner_name: full.pending_owner_id
        ? (nameById.get(full.pending_owner_id) ?? null)
        : null,
      pending_owner_at: full.pending_owner_at,
      owner_id: full.owner_id,
      owner_name: nameById.get(full.owner_id) ?? null,
      is_owner: guard.isOwner,
      created_at: full.created_at,
    },
    pending,
    members: memberList,
  };
}

// =============================================================================
// Club CRUD
// =============================================================================

async function probeUniqueSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  base: string,
  ignoreId?: string,
): Promise<string> {
  const { data } = (await supabase
    .from("clubs")
    .select("slug")
    .ilike("slug", `${base}%`)
    .limit(50)) as { data: Array<{ slug: string }> | null };
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (ignoreId) {
    const { data: own } = (await supabase
      .from("clubs")
      .select("slug")
      .eq("id", ignoreId)
      .maybeSingle()) as { data: { slug: string } | null };
    if (own?.slug) taken.delete(own.slug);
  }
  return dedupeSlug(base, taken);
}

export async function createClub(input: unknown): Promise<SaveResult<{ id: string; slug: string }>> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = ClubFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  // The slug coming from the form already passed validation but might
  // collide with an existing club — dedupe just in case.
  const desiredSlug = v.slug || nameToSlug(v.name);
  const finalSlug = await probeUniqueSlug(supabase, desiredSlug);

  const { data, error } = (await supabase
    .from("clubs")
    .insert({
      owner_id: userId,
      slug: finalSlug,
      name: v.name,
      description: v.description,
      logo_url: v.logo_url,
      city: v.city,
      country: v.country,
      join_policy: v.join_policy,
      hide_owner: v.hide_owner,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select("id, slug")
    .single()) as {
    data: { id: string; slug: string } | null;
    error: { message: string } | null;
  };

  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };

  // Auto-add the founder as an approved admin (so the membership UI is
  // consistent — the owner is always a member of their own club).
  await supabase.from("club_members").insert({
    club_id: data.id,
    user_id: userId,
    status: "approved",
    role: "admin",
    applied_at: new Date().toISOString(),
    decided_at: new Date().toISOString(),
    decided_by: userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  revalidatePath("/me/clubs");
  revalidatePath("/me/clubs/owned");
  revalidatePath("/clubs");
  return { ok: true, data: { id: data.id, slug: data.slug } };
}

export async function updateClub(
  id: string,
  input: unknown,
): Promise<SaveResult<{ slug: string }>> {
  const guard = await requireClubAdmin(id);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { supabase, club } = guard;

  const parsed = ClubFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  // Slug edits are owner-only (co-admins keep the rest).
  const slugChanged = v.slug !== club.slug;
  let finalSlug = club.slug;
  if (slugChanged) {
    if (!guard.isOwner) return { ok: false, error: "slug_owner_only" };
    finalSlug = await probeUniqueSlug(supabase, v.slug, id);
  }

  const { error } = await supabase
    .from("clubs")
    .update({
      slug: finalSlug,
      name: v.name,
      description: v.description,
      logo_url: v.logo_url,
      city: v.city,
      country: v.country,
      join_policy: v.join_policy,
      hide_owner: v.hide_owner,
    } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/me/clubs/owned/${id}`);
  revalidatePath("/me/clubs/owned");
  revalidatePath(`/clubs/${finalSlug}`);
  if (slugChanged) revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/clubs");
  return { ok: true, data: { slug: finalSlug } };
}

export async function setClubLogoUrl(
  id: string,
  logoUrl: string | null,
): Promise<SaveResult> {
  const guard = await requireClubAdmin(id);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { supabase, club } = guard;

  const { error } = await supabase
    .from("clubs")
    .update({ logo_url: logoUrl } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/me/clubs/owned/${id}`);
  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/clubs");
  return { ok: true };
}

export async function deleteClub(id: string): Promise<SaveResult> {
  const guard = await requireClubAdmin(id);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!guard.isOwner) return { ok: false, error: "owner_only" };
  const { supabase, club } = guard;

  const { error } = await supabase.from("clubs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/clubs");
  revalidatePath("/me/clubs/owned");
  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/clubs");
  return { ok: true };
}

// =============================================================================
// Applications & members
// =============================================================================

export async function decideApplication(input: unknown): Promise<SaveResult> {
  const parsed = DecideApplicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { data: member } = (await supabase
    .from("club_members")
    .select("id, club_id, user_id, status")
    .eq("id", v.member_id)
    .maybeSingle()) as {
    data: { id: string; club_id: string; user_id: string; status: MemberStatus } | null;
  };
  if (!member) return { ok: false, error: "not_found" };
  if (member.status !== "pending") return { ok: false, error: "not_pending" };

  const guard = await requireClubAdmin(member.club_id);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { club } = guard;

  const { error } = await supabase
    .from("club_members")
    .update({
      status: v.decision,
      decided_at: new Date().toISOString(),
      decided_by: userId,
    } as never)
    .eq("id", v.member_id);
  if (error) return { ok: false, error: error.message };

  // Notify the applicant — best-effort.
  try {
    const service = createSupabaseServiceClient();
    await notifyUser(service, {
      recipientId: member.user_id,
      template:
        v.decision === "approved" ? "club_application_approved" : "club_application_rejected",
      payload: {
        club_id: club.id,
        club_name: club.name,
        club_slug: club.slug,
        reason: v.reason ?? "",
      },
      linkUrl: `/clubs/${club.slug}`,
    });
  } catch (e) {
    console.warn("[clubs] failed to enqueue decision email:", e);
  }

  revalidatePath(`/me/clubs/owned/${member.club_id}`);
  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/me/clubs");
  return { ok: true };
}

export async function setMemberRole(input: unknown): Promise<SaveResult> {
  const parsed = SetMemberRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: member } = (await supabase
    .from("club_members")
    .select("id, club_id, user_id, status")
    .eq("id", v.member_id)
    .maybeSingle()) as {
    data: { id: string; club_id: string; user_id: string; status: MemberStatus } | null;
  };
  if (!member) return { ok: false, error: "not_found" };
  if (member.status !== "approved") return { ok: false, error: "not_approved" };

  const guard = await requireClubAdmin(member.club_id);
  if (!guard.ok) return { ok: false, error: guard.error };
  // Only the owner may promote/demote co-admins (avoids admin-vs-admin wars).
  if (!guard.isOwner) return { ok: false, error: "owner_only" };
  if (member.user_id === guard.userId) return { ok: false, error: "cannot_change_own_role" };

  const { error } = await supabase
    .from("club_members")
    .update({ role: v.role } as never)
    .eq("id", v.member_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/me/clubs/owned/${member.club_id}`);
  return { ok: true };
}

export async function removeMember(
  memberId: string,
  reason: string | null = null,
): Promise<SaveResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { data: member } = (await supabase
    .from("club_members")
    .select("id, club_id, user_id, status, role")
    .eq("id", memberId)
    .maybeSingle()) as {
    data: {
      id: string;
      club_id: string;
      user_id: string;
      status: MemberStatus;
      role: MemberRole;
    } | null;
  };
  if (!member) return { ok: false, error: "not_found" };

  const guard = await requireClubAdmin(member.club_id);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { club } = guard;

  // A co-admin cannot kick another co-admin or the owner; only the owner can.
  if (!guard.isOwner && (member.role === "admin" || member.user_id === club.owner_id)) {
    return { ok: false, error: "owner_only" };
  }
  // The owner cannot kick themselves (would orphan the club).
  if (member.user_id === club.owner_id) return { ok: false, error: "cannot_kick_owner" };

  const { error } = await supabase.from("club_members").delete().eq("id", memberId);
  if (error) return { ok: false, error: error.message };

  // Notify the kicked user — best-effort.
  if (member.status === "approved") {
    try {
      const service = createSupabaseServiceClient();
      await notifyUser(service, {
        recipientId: member.user_id,
        template: "club_member_kicked",
        payload: { club_name: club.name, reason: reason ?? "" },
      });
    } catch (e) {
      console.warn("[clubs] failed to enqueue kick email:", e);
    }
  }

  revalidatePath(`/me/clubs/owned/${member.club_id}`);
  revalidatePath(`/clubs/${club.slug}`);
  return { ok: true };
}

export async function addMember(input: unknown): Promise<SaveResult> {
  const parsed = AddMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  const guard = await requireClubAdmin(v.club_id);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { supabase, userId, club } = guard;

  // Co-admins can add regular members; admin promotion stays owner-only.
  if (v.role === "admin" && !guard.isOwner) return { ok: false, error: "owner_only" };

  // Detect existing row to decide insert vs update (avoid unique conflict).
  const { data: existing } = (await supabase
    .from("club_members")
    .select("id, status")
    .eq("club_id", v.club_id)
    .eq("user_id", v.user_id)
    .maybeSingle()) as { data: { id: string; status: MemberStatus } | null };

  if (existing) {
    if (existing.status === "approved") return { ok: false, error: "already_member" };
    const { error } = await supabase
      .from("club_members")
      .update({
        status: "approved",
        role: v.role,
        decided_at: new Date().toISOString(),
        decided_by: userId,
      } as never)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("club_members").insert({
      club_id: v.club_id,
      user_id: v.user_id,
      status: "approved",
      role: v.role,
      applied_at: new Date().toISOString(),
      decided_at: new Date().toISOString(),
      decided_by: userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/me/clubs/owned/${v.club_id}`);
  revalidatePath(`/clubs/${club.slug}`);
  return { ok: true };
}

// =============================================================================
// Invite token
// =============================================================================

export async function regenerateInviteToken(
  input: unknown,
): Promise<SaveResult<{ token: string; expires_at: string | null }>> {
  const parsed = InviteTokenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  const guard = await requireClubAdmin(v.club_id);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { supabase } = guard;

  const { token, hash } = generateInviteToken();
  const expiresAt =
    v.expires_in_days === 0
      ? null
      : new Date(Date.now() + v.expires_in_days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("clubs")
    .update({
      invite_token_hash: hash,
      invite_expires_at: expiresAt,
    } as never)
    .eq("id", v.club_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/me/clubs/owned/${v.club_id}`);
  return { ok: true, data: { token, expires_at: expiresAt } };
}

export async function revokeInviteToken(clubId: string): Promise<SaveResult> {
  const guard = await requireClubAdmin(clubId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { supabase } = guard;

  const { error } = await supabase
    .from("clubs")
    .update({ invite_token_hash: null, invite_expires_at: null } as never)
    .eq("id", clubId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/me/clubs/owned/${clubId}`);
  return { ok: true };
}

// =============================================================================
// Ownership transfer (two-step)
// =============================================================================

export async function proposeOwnership(input: unknown): Promise<SaveResult> {
  const parsed = ProposeOwnershipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  const guard = await requireClubAdmin(v.club_id);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!guard.isOwner) return { ok: false, error: "owner_only" };
  const { supabase, userId, club } = guard;

  if (v.new_owner_id === userId) return { ok: false, error: "cannot_transfer_to_self" };

  // Candidate must already be an approved member of the club.
  const { data: cm } = (await supabase
    .from("club_members")
    .select("status")
    .eq("club_id", v.club_id)
    .eq("user_id", v.new_owner_id)
    .maybeSingle()) as { data: { status: MemberStatus } | null };
  if (!cm || cm.status !== "approved") return { ok: false, error: "candidate_not_member" };

  const { error } = await supabase
    .from("clubs")
    .update({
      pending_owner_id: v.new_owner_id,
      pending_owner_at: new Date().toISOString(),
    } as never)
    .eq("id", v.club_id);
  if (error) return { ok: false, error: error.message };

  try {
    const { data: prev } = (await supabase
      .from("public_player_basic")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()) as { data: { display_name: string | null } | null };
    const service = createSupabaseServiceClient();
    await notifyUser(service, {
      recipientId: v.new_owner_id,
      template: "club_ownership_offered",
      payload: {
        club_name: club.name,
        previous_owner_name: prev?.display_name ?? "",
      },
      linkUrl: "/me/clubs",
    });
  } catch (e) {
    console.warn("[clubs] failed to enqueue ownership-offer email:", e);
  }

  revalidatePath(`/me/clubs/owned/${v.club_id}`);
  revalidatePath("/me/clubs");
  return { ok: true };
}

export async function cancelOwnershipTransfer(clubId: string): Promise<SaveResult> {
  const guard = await requireClubAdmin(clubId);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!guard.isOwner) return { ok: false, error: "owner_only" };
  const { supabase } = guard;

  const { error } = await supabase
    .from("clubs")
    .update({ pending_owner_id: null, pending_owner_at: null } as never)
    .eq("id", clubId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/me/clubs/owned/${clubId}`);
  return { ok: true };
}
