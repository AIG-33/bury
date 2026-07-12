"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { enqueue } from "@/lib/notifications/outbox";
import type { Locale } from "@/lib/notifications/templates";
import type {
  TournamentFormat,
  TournamentStatus,
  Surface,
  Privacy,
  MatchRules,
} from "@/lib/tournaments/schema";

// =============================================================================
// Types returned to UI
// =============================================================================

export type ApplicationStatus = "pending" | "approved" | "rejected" | "none";

export type OpenTournamentRow = {
  id: string;
  name: string;
  description: string | null;
  format: TournamentFormat;
  surface: Surface | null;
  starts_on: string;
  ends_on: string | null;
  registration_deadline: string | null;
  max_participants: number | null;
  participants_count: number;
  privacy: Privacy;
  status: TournamentStatus;
  organizer_name: string | null;
  application_status: ApplicationStatus;
  match_rules: MatchRules;
};

export type MyTournamentRow = OpenTournamentRow & {
  withdrawn: boolean;
  next_match: {
    id: string;
    round: number | null;
    opponent_name: string | null;
    scheduled_at: string | null;
  } | null;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  return { ok: true as const, supabase, userId: user.id };
}

// =============================================================================
// Viewer state — used by the public tournament page to decide whether to show
// an "Apply" button, a status pill, or a "sign in" link. Kept read-only and
// RLS-safe (a non-owner, non-participant reading a club tournament simply gets
// `isOwner=false` because the row isn't visible to them).
// =============================================================================

export type TournamentViewerState =
  | { authenticated: false }
  | { authenticated: true; isOwner: boolean; applicationStatus: ApplicationStatus };

export async function loadTournamentViewerState(
  tournamentId: string,
): Promise<TournamentViewerState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { authenticated: false };

  const { data: t } = (await supabase
    .from("tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .maybeSingle()) as { data: { owner_id: string } | null };

  const { data: part } = (await supabase
    .from("tournament_participants")
    .select("status, withdrawn")
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id)
    .maybeSingle()) as {
    data: { status: "pending" | "approved" | "rejected"; withdrawn: boolean } | null;
  };

  const applicationStatus: ApplicationStatus =
    part && !part.withdrawn ? part.status : "none";

  return {
    authenticated: true,
    isOwner: t?.owner_id === user.id,
    applicationStatus,
  };
}

// =============================================================================
// Open registrations — public tournaments with registration open.
// =============================================================================

export async function loadOpenTournaments(): Promise<
  | { ok: true; tournaments: OpenTournamentRow[] }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: rows } = (await supabase
    .from("tournaments")
    .select(
      "id, owner_id, name, description, format, surface, starts_on, ends_on, registration_deadline, " +
        "max_participants, privacy, status, match_rules",
    )
    .eq("privacy", "public")
    .eq("status", "registration")
    .order("starts_on", { ascending: true })) as {
    data: Array<
      Omit<
        OpenTournamentRow,
        "participants_count" | "application_status" | "organizer_name"
      > & {
        owner_id: string;
      }
    > | null;
  };

  const ownerIds = Array.from(new Set((rows ?? []).map((r) => r.owner_id)));
  const ownerNameById = new Map<string, string | null>();
  if (ownerIds.length > 0) {
    const { data: owners } = (await supabase
      .from("public_profile_basic")
      .select("id, display_name")
      .in("id", ownerIds)) as {
      data: Array<{ id: string; display_name: string | null }> | null;
    };
    for (const o of owners ?? []) ownerNameById.set(o.id, o.display_name);
  }

  const tournaments = (rows ?? []).map((r) => ({
    ...r,
    organizer_name: ownerNameById.get(r.owner_id) ?? null,
  }));

  const ids = tournaments.map((t) => t.id);
  const counts = new Map<string, number>();
  const myStatus = new Map<string, ApplicationStatus>();
  if (ids.length > 0) {
    const { data: parts } = (await supabase
      .from("tournament_participants")
      .select("tournament_id, player_id, status, withdrawn")
      .in("tournament_id", ids)) as {
      data: Array<{
        tournament_id: string;
        player_id: string;
        status: "pending" | "approved" | "rejected";
        withdrawn: boolean;
      }> | null;
    };
    for (const p of parts ?? []) {
      // Approved + not withdrawn = visible "filled seat".
      if (p.status === "approved" && !p.withdrawn) {
        counts.set(p.tournament_id, (counts.get(p.tournament_id) ?? 0) + 1);
      }
      if (p.player_id === userId) myStatus.set(p.tournament_id, p.status);
    }
  }

  return {
    ok: true,
    tournaments: tournaments.map((t) => ({
      ...t,
      participants_count: counts.get(t.id) ?? 0,
      application_status: myStatus.get(t.id) ?? "none",
    })),
  };
}

// =============================================================================
// "My tournaments" — anything I'm registered in (active or not).
// =============================================================================

export async function loadMyTournaments(): Promise<
  | { ok: true; tournaments: MyTournamentRow[] }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: regs } = (await supabase
    .from("tournament_participants")
    .select(
      "tournament_id, status, withdrawn, " +
        "tournaments(id, owner_id, name, description, format, surface, starts_on, ends_on, " +
        "registration_deadline, max_participants, privacy, status, match_rules)",
    )
    .eq("player_id", userId)) as {
    data: Array<{
      tournament_id: string;
      status: "pending" | "approved" | "rejected";
      withdrawn: boolean;
      tournaments: {
        id: string;
        owner_id: string;
        name: string;
        description: string | null;
        format: TournamentFormat;
        surface: Surface | null;
        starts_on: string;
        ends_on: string | null;
        registration_deadline: string | null;
        max_participants: number | null;
        privacy: Privacy;
        status: TournamentStatus;
        match_rules: MatchRules;
      } | null;
    }> | null;
  };

  const filtered = (regs ?? []).filter((r) => r.tournaments != null);
  const ids = filtered.map((r) => r.tournament_id);

  const ownerIds = Array.from(new Set(filtered.map((r) => r.tournaments!.owner_id)));
  const organizerNameById = new Map<string, string | null>();
  if (ownerIds.length > 0) {
    const { data: owners } = (await supabase
      .from("public_profile_basic")
      .select("id, display_name")
      .in("id", ownerIds)) as {
      data: Array<{ id: string; display_name: string | null }> | null;
    };
    for (const o of owners ?? []) organizerNameById.set(o.id, o.display_name);
  }

  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: cnt } = (await supabase
      .from("tournament_participants")
      .select("tournament_id, status, withdrawn")
      .in("tournament_id", ids)
      .eq("status", "approved")) as {
      data: Array<{ tournament_id: string; status: string; withdrawn: boolean }> | null;
    };
    for (const c of cnt ?? []) {
      if (!c.withdrawn) counts.set(c.tournament_id, (counts.get(c.tournament_id) ?? 0) + 1);
    }
  }

  const nextMatches = new Map<
    string,
    { id: string; round: number | null; opponent_id: string | null; scheduled_at: string | null }
  >();
  if (ids.length > 0) {
    const { data: ms } = (await supabase
      .from("matches")
      .select("id, tournament_id, round, p1_id, p2_id, outcome, scheduled_at")
      .in("tournament_id", ids)
      .or(`p1_id.eq.${userId},p2_id.eq.${userId}`)
      .in("outcome", ["pending", "scheduled"])
      .order("round", { ascending: true })
      .order("scheduled_at", { ascending: true, nullsFirst: false })) as {
      data: Array<{
        id: string;
        tournament_id: string;
        round: number | null;
        p1_id: string;
        p2_id: string | null;
        outcome: string;
        scheduled_at: string | null;
      }> | null;
    };
    for (const m of ms ?? []) {
      if (nextMatches.has(m.tournament_id)) continue;
      const opponentId = m.p1_id === userId ? m.p2_id : m.p1_id;
      nextMatches.set(m.tournament_id, {
        id: m.id,
        round: m.round,
        opponent_id: opponentId,
        scheduled_at: m.scheduled_at,
      });
    }
  }

  const opponentIds = Array.from(nextMatches.values())
    .map((v) => v.opponent_id)
    .filter((x): x is string => x !== null);
  const namesById = new Map<string, string | null>();
  if (opponentIds.length > 0) {
    const { data: ps } = (await supabase
      .from("public_profile_basic")
      .select("id, display_name")
      .in("id", opponentIds)) as {
      data: Array<{ id: string; display_name: string | null }> | null;
    };
    for (const p of ps ?? []) namesById.set(p.id, p.display_name);
  }

  const tournaments: MyTournamentRow[] = filtered.map((r) => {
    const t = r.tournaments!;
    const next = nextMatches.get(t.id);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      format: t.format,
      surface: t.surface,
      starts_on: t.starts_on,
      ends_on: t.ends_on,
      registration_deadline: t.registration_deadline,
      max_participants: t.max_participants,
      privacy: t.privacy,
      status: t.status,
      participants_count: counts.get(t.id) ?? 0,
      organizer_name: organizerNameById.get(t.owner_id) ?? null,
      application_status: r.status,
      match_rules: t.match_rules,
      withdrawn: r.withdrawn,
      next_match: next
        ? {
            id: next.id,
            round: next.round,
            opponent_name: next.opponent_id ? namesById.get(next.opponent_id) ?? null : null,
            scheduled_at: next.scheduled_at,
          }
        : null,
    };
  });

  return { ok: true, tournaments };
}

// =============================================================================
// Apply / withdraw
// =============================================================================

/**
 * Submit an application to a tournament. Players are NOT auto-approved any
 * more — the row is created with status='pending' and the organizer must
 * approve or reject it.
 */
export async function applyToTournament(
  tournamentId: string,
): Promise<{ ok: true; status: "pending" } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, name, status, max_participants, registration_deadline")
    .eq("id", tournamentId)
    .single()) as {
    data: {
      id: string;
      owner_id: string;
      name: string;
      status: TournamentStatus;
      max_participants: number | null;
      registration_deadline: string | null;
    } | null;
  };
  if (!t) return { ok: false, error: "not_found" };
  if (t.owner_id === userId) return { ok: false, error: "cant_apply_to_own_tournament" };
  // Drafts are organizer-private: applications open only once the organizer
  // explicitly flips the tournament to "registration".
  if (t.status !== "registration") {
    return { ok: false, error: "registration_closed" };
  }
  if (t.registration_deadline && new Date(t.registration_deadline) < new Date()) {
    return { ok: false, error: "deadline_passed" };
  }

  if (t.max_participants != null) {
    const { data: cnt } = (await supabase
      .from("tournament_participants")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("status", "approved")
      .eq("withdrawn", false)) as { data: Array<{ id: string }> | null };
    if ((cnt?.length ?? 0) >= t.max_participants) {
      return { ok: false, error: "full" };
    }
  }

  // Existing row? Resurrect it on reapplication; reset status to 'pending'
  // so the owner gets a fresh decision to make.
  const { data: existing } = (await supabase
    .from("tournament_participants")
    .select("id, status, withdrawn")
    .eq("tournament_id", tournamentId)
    .eq("player_id", userId)
    .maybeSingle()) as {
    data: { id: string; status: "pending" | "approved" | "rejected"; withdrawn: boolean } | null;
  };

  if (existing) {
    if (existing.status === "pending" && !existing.withdrawn) {
      return { ok: true, status: "pending" };
    }
    const { error } = await supabase
      .from("tournament_participants")
      .update({ status: "pending", withdrawn: false } as never)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("tournament_participants")
      .insert({
        tournament_id: tournamentId,
        player_id: userId,
        status: "pending",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    if (error) return { ok: false, error: error.message };
  }

  // Best-effort notification to organizer that a new application landed.
  try {
    const { data: ownerProfile } = (await supabase
      .from("profiles")
      .select("locale, notification_email")
      .eq("id", t.owner_id)
      .single()) as { data: { locale: Locale; notification_email: boolean } | null };
    if (ownerProfile?.notification_email) {
      const service = createSupabaseServiceClient();
      await enqueue(service, {
        recipient_id: t.owner_id,
        channel: "email",
        template: "tournament_application_submitted",
        locale: ownerProfile.locale,
        payload: {
          tournament_id: tournamentId,
          tournament_name: t.name,
        },
      });
    }
  } catch (e) {
    console.warn("[tournaments] failed to enqueue organizer notification:", e);
  }

  revalidatePath("/me/tournaments");
  revalidatePath(`/me/tournaments/organized/${tournamentId}`);
  return { ok: true, status: "pending" };
}

/**
 * Cancel an application or withdraw post-approval.
 *   - If the row is still 'pending' or 'rejected', we hard-delete (the
 *     player is taking back their request entirely).
 *   - If 'approved' and tournament not started → hard-delete (still
 *     no consequences, frees the seat).
 *   - If 'approved' and tournament started → soft withdraw to keep
 *     historical participation visible in /matches & standings.
 */
export async function withdrawFromTournament(
  tournamentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, status")
    .eq("id", tournamentId)
    .single()) as { data: { id: string; status: TournamentStatus } | null };
  if (!t) return { ok: false, error: "not_found" };

  const wantHardDelete = t.status === "draft" || t.status === "registration";

  if (wantHardDelete) {
    const { error } = await supabase
      .from("tournament_participants")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("player_id", userId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("tournament_participants")
      .update({ withdrawn: true } as never)
      .eq("tournament_id", tournamentId)
      .eq("player_id", userId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/me/tournaments");
  return { ok: true };
}
