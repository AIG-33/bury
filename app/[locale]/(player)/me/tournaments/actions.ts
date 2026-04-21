"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  coach_name: string | null;
  is_registered: boolean;
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
// Open registrations — public + draft/registration tournaments not yet started.
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
      "id, name, description, format, surface, starts_on, ends_on, registration_deadline, " +
        "max_participants, privacy, status, match_rules, " +
        "profiles!tournaments_owner_coach_id_fkey(display_name)",
    )
    .eq("privacy", "public")
    .in("status", ["draft", "registration"])
    .order("starts_on", { ascending: true })) as {
    data: Array<
      Omit<OpenTournamentRow, "participants_count" | "is_registered" | "coach_name"> & {
        profiles: { display_name: string | null } | null;
      }
    > | null;
  };

  const tournaments = (rows ?? []).map((r) => ({
    ...r,
    coach_name: r.profiles?.display_name ?? null,
  }));

  const ids = tournaments.map((t) => t.id);
  const counts = new Map<string, number>();
  const myRegs = new Set<string>();
  if (ids.length > 0) {
    const { data: parts } = (await supabase
      .from("tournament_participants")
      .select("tournament_id, player_id, withdrawn")
      .in("tournament_id", ids)) as {
      data: Array<{ tournament_id: string; player_id: string; withdrawn: boolean }> | null;
    };
    for (const p of parts ?? []) {
      if (!p.withdrawn) {
        counts.set(p.tournament_id, (counts.get(p.tournament_id) ?? 0) + 1);
      }
      if (p.player_id === userId) myRegs.add(p.tournament_id);
    }
  }

  return {
    ok: true,
    tournaments: tournaments.map((t) => ({
      ...t,
      participants_count: counts.get(t.id) ?? 0,
      is_registered: myRegs.has(t.id),
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
      "tournament_id, withdrawn, " +
        "tournaments(id, name, description, format, surface, starts_on, ends_on, " +
        "registration_deadline, max_participants, privacy, status, match_rules, " +
        "profiles!tournaments_owner_coach_id_fkey(display_name))",
    )
    .eq("player_id", userId)) as {
    data: Array<{
      tournament_id: string;
      withdrawn: boolean;
      tournaments: {
        id: string;
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
        profiles: { display_name: string | null } | null;
      } | null;
    }> | null;
  };

  const filtered = (regs ?? []).filter((r) => r.tournaments != null);
  const ids = filtered.map((r) => r.tournament_id);

  // Headcounts.
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: cnt } = (await supabase
      .from("tournament_participants")
      .select("tournament_id, withdrawn")
      .in("tournament_id", ids)) as {
      data: Array<{ tournament_id: string; withdrawn: boolean }> | null;
    };
    for (const c of cnt ?? []) {
      if (!c.withdrawn) counts.set(c.tournament_id, (counts.get(c.tournament_id) ?? 0) + 1);
    }
  }

  // Next pending match per tournament for the current user.
  const nextMatches = new Map<
    string,
    { id: string; round: number | null; opponent_id: string | null; scheduled_at: string | null }
  >();
  if (ids.length > 0) {
    const { data: ms } = (await supabase
      .from("matches")
      .select(
        "id, tournament_id, round, p1_id, p2_id, outcome, scheduled_at",
      )
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

  // Resolve opponent display names.
  const opponentIds = Array.from(nextMatches.values())
    .map((v) => v.opponent_id)
    .filter((x): x is string => x !== null);
  const namesById = new Map<string, string | null>();
  if (opponentIds.length > 0) {
    const { data: ps } = (await supabase
      .from("profiles")
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
      coach_name: t.profiles?.display_name ?? null,
      is_registered: !r.withdrawn,
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
// Register / withdraw
// =============================================================================

export async function registerForTournament(
  tournamentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  // Ensure tournament is open for registration.
  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, status, max_participants, registration_deadline")
    .eq("id", tournamentId)
    .single()) as {
    data: {
      id: string;
      status: TournamentStatus;
      max_participants: number | null;
      registration_deadline: string | null;
    } | null;
  };
  if (!t) return { ok: false, error: "not_found" };
  if (t.status !== "draft" && t.status !== "registration") {
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
      .eq("withdrawn", false)) as { data: Array<{ id: string }> | null };
    if ((cnt?.length ?? 0) >= t.max_participants) {
      return { ok: false, error: "full" };
    }
  }

  // If a withdrawn row exists → revive it; otherwise insert.
  const { data: existing } = (await supabase
    .from("tournament_participants")
    .select("id, withdrawn")
    .eq("tournament_id", tournamentId)
    .eq("player_id", userId)
    .maybeSingle()) as { data: { id: string; withdrawn: boolean } | null };

  if (existing) {
    if (!existing.withdrawn) return { ok: true }; // already registered
    const { error } = await supabase
      .from("tournament_participants")
      .update({ withdrawn: false } as never)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("tournament_participants")
      .insert({
        tournament_id: tournamentId,
        player_id: userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/me/tournaments");
  return { ok: true };
}

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
  // Once the tournament has begun, withdrawal is a "soft" action (keeps history).
  const wantHardDelete =
    t.status === "draft" || t.status === "registration";

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
