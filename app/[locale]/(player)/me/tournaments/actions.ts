"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications/notify";
import type {
  TournamentFormat,
  TournamentStatus,
  TournamentDiscipline,
  Surface,
  Privacy,
  ApplicationMode,
  MatchRules,
} from "@/lib/tournaments/schema";
import { validatePairRegistration } from "@/lib/tournaments/pairs";
import { decideApplication } from "@/lib/tournaments/applications";
import {
  tournamentBrandingFromRow,
  type TournamentBranding,
} from "@/lib/validators/tournament-branding";

// =============================================================================
// Types returned to UI
// =============================================================================

export type ApplicationStatus = "pending" | "approved" | "rejected" | "none";

export type OpenTournamentRow = {
  id: string;
  name: string;
  description: string | null;
  format: TournamentFormat;
  discipline: TournamentDiscipline;
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
    opponent_id: string | null;
    opponent_name: string | null;
    scheduled_at: string | null;
  } | null;
  // Extra card fields for the mobile branded list (additive — web pages
  // that predate them simply ignore these).
  start_time: string | null;
  entry_fee_byn: number | null;
  branding: TournamentBranding;
  venues: Array<{ id: string; name: string; city: string | null }>;
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

  // A doubles pair occupies one row; being someone's partner counts as
  // being registered too (blocks double-application, shows the status pill).
  const { data: part } = (await supabase
    .from("tournament_participants")
    .select("status, withdrawn")
    .eq("tournament_id", tournamentId)
    .or(`player_id.eq.${user.id},partner_id.eq.${user.id}`)
    .maybeSingle()) as {
    data: { status: "pending" | "approved" | "rejected"; withdrawn: boolean } | null;
  };

  const applicationStatus: ApplicationStatus = part && !part.withdrawn ? part.status : "none";

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
  { ok: true; tournaments: OpenTournamentRow[] } | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: rows } = (await supabase
    .from("tournaments")
    .select(
      "id, owner_id, name, description, format, discipline, surface, starts_on, ends_on, registration_deadline, " +
        "max_participants, privacy, status, match_rules",
    )
    .eq("privacy", "public")
    .eq("status", "registration")
    .order("starts_on", { ascending: true })) as {
    data: Array<
      Omit<OpenTournamentRow, "participants_count" | "application_status" | "organizer_name"> & {
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
      .select("tournament_id, player_id, partner_id, status, withdrawn")
      .in("tournament_id", ids)) as {
      data: Array<{
        tournament_id: string;
        player_id: string;
        partner_id: string | null;
        status: "pending" | "approved" | "rejected";
        withdrawn: boolean;
      }> | null;
    };
    for (const p of parts ?? []) {
      // Approved + not withdrawn = visible "filled seat".
      if (p.status === "approved" && !p.withdrawn) {
        counts.set(p.tournament_id, (counts.get(p.tournament_id) ?? 0) + 1);
      }
      // Registered either as the pair captain or as somebody's partner.
      if (p.player_id === userId || p.partner_id === userId) {
        myStatus.set(p.tournament_id, p.status);
      }
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
  { ok: true; tournaments: MyTournamentRow[] } | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: regs } = (await supabase
    .from("tournament_participants")
    .select(
      "tournament_id, status, withdrawn, " +
        "tournaments(id, owner_id, name, description, format, discipline, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_byn, privacy, status, match_rules, branding)",
    )
    // Doubles pairs occupy one row — the partner sees the tournament too.
    .or(`player_id.eq.${userId},partner_id.eq.${userId}`)) as {
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
        discipline: TournamentDiscipline;
        surface: Surface | null;
        starts_on: string;
        start_time: string | null;
        ends_on: string | null;
        registration_deadline: string | null;
        max_participants: number | null;
        entry_fee_byn: number | null;
        privacy: Privacy;
        status: TournamentStatus;
        match_rules: MatchRules;
        branding: unknown;
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
  const venuesByT = new Map<string, Array<{ id: string; name: string; city: string | null }>>();
  if (ids.length > 0) {
    const [{ data: cnt }, { data: tvs }] = await Promise.all([
      supabase
        .from("tournament_participants")
        .select("tournament_id, status, withdrawn")
        .in("tournament_id", ids)
        .eq("status", "approved") as unknown as Promise<{
        data: Array<{ tournament_id: string; status: string; withdrawn: boolean }> | null;
      }>,
      supabase
        .from("tournament_venues")
        .select("tournament_id, venues!inner(id, name, city)")
        .in("tournament_id", ids) as unknown as Promise<{
        data: Array<{
          tournament_id: string;
          venues:
            | { id: string; name: string; city: string | null }
            | Array<{ id: string; name: string; city: string | null }>;
        }> | null;
      }>,
    ]);
    for (const c of cnt ?? []) {
      if (!c.withdrawn) counts.set(c.tournament_id, (counts.get(c.tournament_id) ?? 0) + 1);
    }
    for (const v of tvs ?? []) {
      const ref = Array.isArray(v.venues) ? v.venues[0] : v.venues;
      if (!ref) continue;
      const arr = venuesByT.get(v.tournament_id) ?? [];
      arr.push({ id: ref.id, name: ref.name, city: ref.city });
      venuesByT.set(v.tournament_id, arr);
    }
  }

  const nextMatches = new Map<
    string,
    { id: string; round: number | null; opponent_id: string | null; scheduled_at: string | null }
  >();
  if (ids.length > 0) {
    const { data: ms } = (await supabase
      .from("matches")
      .select("id, tournament_id, round, p1_id, p2_id, p1_partner_id, p2_partner_id, outcome, scheduled_at")
      .in("tournament_id", ids)
      .or(
        `p1_id.eq.${userId},p2_id.eq.${userId},p1_partner_id.eq.${userId},p2_partner_id.eq.${userId}`,
      )
      .in("outcome", ["pending", "scheduled"])
      .order("round", { ascending: true })
      .order("scheduled_at", { ascending: true, nullsFirst: false })) as {
      data: Array<{
        id: string;
        tournament_id: string;
        round: number | null;
        p1_id: string;
        p2_id: string | null;
        p1_partner_id: string | null;
        p2_partner_id: string | null;
        outcome: string;
        scheduled_at: string | null;
      }> | null;
    };
    for (const m of ms ?? []) {
      if (nextMatches.has(m.tournament_id)) continue;
      // "Opponent" = the other side's captain (pairs show the captain's name).
      const onP1Side = m.p1_id === userId || m.p1_partner_id === userId;
      const opponentId = onP1Side ? m.p2_id : m.p1_id;
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
      discipline: t.discipline,
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
      start_time: t.start_time,
      entry_fee_byn: t.entry_fee_byn,
      branding: tournamentBrandingFromRow(t.branding),
      venues: venuesByT.get(t.id) ?? [],
      next_match: next
        ? {
            id: next.id,
            round: next.round,
            opponent_id: next.opponent_id,
            opponent_name: next.opponent_id ? (namesById.get(next.opponent_id) ?? null) : null,
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
 * Submit an application to a tournament. What happens next depends on the
 * tournament's `application_mode`:
 *   – 'manual' (default) — the row is created with status='pending' and the
 *     organizer approves or rejects it by hand;
 *   – 'auto' — the row is approved immediately (registration window and
 *     capacity are validated here; the approved write goes through the
 *     service role because RLS keeps client-side inserts pending-only).
 */
export async function applyToTournament(
  tournamentId: string,
  opts: { partnerId?: string | null } = {},
): Promise<{ ok: true; status: "pending" | "approved" } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: t } = (await supabase
    .from("tournaments")
    .select(
      "id, owner_id, name, status, discipline, max_participants, registration_deadline, application_mode",
    )
    .eq("id", tournamentId)
    .single()) as {
    data: {
      id: string;
      owner_id: string;
      name: string;
      status: TournamentStatus;
      discipline: TournamentDiscipline;
      max_participants: number | null;
      registration_deadline: string | null;
      application_mode: ApplicationMode;
    } | null;
  };
  if (!t) return { ok: false, error: "not_found" };

  const { data: cnt } = (await supabase
    .from("tournament_participants")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .eq("withdrawn", false)) as { data: Array<{ id: string }> | null };

  // Existing row? Resurrect it on reapplication so the organizer (or the
  // auto mode) gets a fresh decision to make.
  const { data: existing } = (await supabase
    .from("tournament_participants")
    .select("id, status, withdrawn")
    .eq("tournament_id", tournamentId)
    .eq("player_id", userId)
    .maybeSingle()) as {
    data: { id: string; status: "pending" | "approved" | "rejected"; withdrawn: boolean } | null;
  };

  // Doubles: the application is for a PAIR. Validate the partner against
  // everyone already registered (in either slot). The applicant's own captain
  // row is excluded — re-applying with a different partner is legitimate.
  let partnerId: string | null = null;
  if (t.discipline === "doubles") {
    const { data: allRows } = (await supabase
      .from("tournament_participants")
      .select("player_id, partner_id")
      .eq("tournament_id", tournamentId)) as {
      data: Array<{ player_id: string; partner_id: string | null }> | null;
    };
    const pair = validatePairRegistration({
      captainId: userId,
      partnerId: opts.partnerId,
      existing: (allRows ?? []).filter((r) => r.player_id !== userId),
    });
    if (!pair.ok) return { ok: false, error: pair.error };
    partnerId = pair.partnerId;
  }

  const decision = decideApplication({
    mode: t.application_mode,
    tournamentStatus: t.status,
    ownerId: t.owner_id,
    playerId: userId,
    registrationDeadline: t.registration_deadline,
    now: new Date(),
    approvedCount: cnt?.length ?? 0,
    maxParticipants: t.max_participants,
    existing,
  });
  if (!decision.ok) return decision;

  if (!decision.noop) {
    // The pending-only `tp_player_register` RLS policy is intentional — a
    // player can never write an approved row themselves. Auto-approval (and
    // resurrecting an old row, which is an UPDATE the player has no policy
    // for) therefore goes through the service role AFTER the checks above.
    const writer =
      decision.nextStatus === "approved" || existing
        ? createSupabaseServiceClient()
        : supabase;
    if (existing) {
      const { error } = await writer
        .from("tournament_participants")
        .update({
          status: decision.nextStatus,
          withdrawn: false,
          // Re-application may name a different partner — refresh the pair.
          ...(t.discipline === "doubles" ? { partner_id: partnerId } : {}),
        } as never)
        .eq("id", existing.id);
      if (error) {
        // Raw DB errors surface as a generic message in the UI — keep the
        // details in the server log so prod failures stay diagnosable.
        console.error(
          `[tournaments] applyToTournament update failed: tournament=${tournamentId} player=${userId} code=${error.code ?? "?"} message=${error.message}`,
        );
        return { ok: false, error: error.message };
      }
    } else {
      const { error } = await writer.from("tournament_participants").insert({
        tournament_id: tournamentId,
        player_id: userId,
        partner_id: partnerId,
        status: decision.nextStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) {
        console.error(
          `[tournaments] applyToTournament insert failed: tournament=${tournamentId} player=${userId} code=${error.code ?? "?"} message=${error.message}`,
        );
        return { ok: false, error: error.message };
      }
    }

    // Best-effort notifications — never fail the action over the outbox.
    try {
      const service = createSupabaseServiceClient();
      await notifyUser(service, {
        recipientId: t.owner_id,
        template: "tournament_application_submitted",
        payload: { tournament_id: tournamentId, tournament_name: t.name },
        linkUrl: `/me/tournaments/organized/${tournamentId}`,
      });
      // Auto mode: the applicant is in immediately — tell them so.
      if (decision.nextStatus === "approved") {
        await notifyUser(service, {
          recipientId: userId,
          template: "tournament_application_approved",
          payload: { tournament_id: tournamentId, tournament_name: t.name },
          linkUrl: `/tournaments/${tournamentId}`,
        });
      }
    } catch (e) {
      console.warn("[tournaments] failed to enqueue application notifications:", e);
    }
  }

  revalidatePath("/me/tournaments");
  revalidatePath(`/me/tournaments/organized/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true, status: decision.nextStatus };
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

  // Either member of a doubles pair may withdraw — the pair can't play
  // without them anyway. Find the row where the caller occupies any slot.
  const { data: row } = (await supabase
    .from("tournament_participants")
    .select("id, player_id, partner_id")
    .eq("tournament_id", tournamentId)
    .or(`player_id.eq.${userId},partner_id.eq.${userId}`)
    .maybeSingle()) as {
    data: { id: string; player_id: string; partner_id: string | null } | null;
  };
  if (!row) return { ok: false, error: "not_registered" };

  const wantHardDelete = t.status === "draft" || t.status === "registration";
  // RLS write policies only know the captain (`player_id = auth.uid()`), so
  // a partner-initiated withdrawal goes through the service role AFTER the
  // membership check above. The soft update always needs it (players have no
  // UPDATE policy on this table at all).
  const writer = row.player_id === userId && wantHardDelete
    ? supabase
    : createSupabaseServiceClient();

  if (wantHardDelete) {
    const { error } = await writer.from("tournament_participants").delete().eq("id", row.id);
    if (error) {
      console.error(
        `[tournaments] withdrawFromTournament delete failed: tournament=${tournamentId} player=${userId} code=${error.code ?? "?"} message=${error.message}`,
      );
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await writer
      .from("tournament_participants")
      .update({ withdrawn: true } as never)
      .eq("id", row.id);
    if (error) {
      console.error(
        `[tournaments] withdrawFromTournament update failed: tournament=${tournamentId} player=${userId} code=${error.code ?? "?"} message=${error.message}`,
      );
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/me/tournaments");
  return { ok: true };
}
