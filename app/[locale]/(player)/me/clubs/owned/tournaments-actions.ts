"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  tournamentBrandingFromRow,
  type TournamentBranding,
} from "@/lib/validators/tournament-branding";
import type {
  TournamentFormat,
  TournamentStatus,
  SeedingMethod,
  Privacy,
  ApplicationMode,
  Surface,
  MatchRules,
  MatchStage,
} from "@/lib/tournaments/schema";

// =============================================================================
// Club organizer panel — read-only aggregates over the club's tournaments.
// Visibility relies on the RLS widened in 20260709000000_tournament_templates:
// a club owner / co-admin reads every tournament of their club (drafts
// included) plus its matches & participants. Managing a tournament stays with
// its owner_id — the panel only links out.
// =============================================================================

export type ClubTournamentRow = {
  id: string;
  name: string;
  description: string | null;
  format: TournamentFormat;
  surface: Surface | null;
  starts_on: string;
  start_time: string | null;
  ends_on: string | null;
  registration_deadline: string | null;
  max_participants: number | null;
  entry_fee_byn: number | null;
  privacy: Privacy;
  application_mode: ApplicationMode;
  status: TournamentStatus;
  draw_method: SeedingMethod | null;
  prizes_description: string | null;
  match_rules: MatchRules;
  third_place_match: boolean;
  /** Public-page branding — carried into "repeat last" copies. */
  branding: TournamentBranding;
  created_at: string;
  organizer_id: string;
  organizer_name: string | null;
  is_mine: boolean;
  participants_count: number;
  pending_applications: number;
  pending_matches: number;
  venue_ids: string[];
};

export type PendingScoreMatch = {
  match_id: string;
  tournament_id: string;
  tournament_name: string;
  tournament_is_mine: boolean;
  round: number | null;
  stage: MatchStage | null;
  p1_name: string | null;
  p2_name: string | null;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  return { ok: true as const, supabase, userId: user.id };
}

async function userAdministersClub(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  clubId: string,
): Promise<boolean> {
  const { data: club } = (await supabase
    .from("clubs")
    .select("owner_id")
    .eq("id", clubId)
    .maybeSingle()) as { data: { owner_id: string } | null };
  if (!club) return false;
  if (club.owner_id === userId) return true;
  const { data: member } = (await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("role", "admin")
    .eq("status", "approved")
    .maybeSingle()) as { data: { id: string } | null };
  return !!member;
}

export async function loadClubTournamentsForAdmin(clubId: string): Promise<
  | {
      ok: true;
      tournaments: ClubTournamentRow[];
      pendingScores: PendingScoreMatch[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  if (!(await userAdministersClub(supabase, userId, clubId))) {
    return { ok: false, error: "not_club_admin" };
  }

  type DbRow = Omit<
    ClubTournamentRow,
    | "organizer_id"
    | "organizer_name"
    | "is_mine"
    | "participants_count"
    | "pending_applications"
    | "pending_matches"
    | "venue_ids"
    | "branding"
  > & { owner_id: string; branding: unknown };

  const { data: rows } = (await supabase
    .from("tournaments")
    .select(
      "id, name, description, format, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_byn, privacy, application_mode, status, " +
        "draw_method, prizes_description, match_rules, third_place_match, branding, created_at, owner_id",
    )
    .eq("club_id", clubId)
    .order("starts_on", { ascending: false })
    .order("created_at", { ascending: false })) as { data: DbRow[] | null };

  const tournaments = rows ?? [];
  const ids = tournaments.map((t) => t.id);
  const tournamentById = new Map(tournaments.map((t) => [t.id, t] as const));

  const approvedCounts = new Map<string, number>();
  const pendingAppCounts = new Map<string, number>();
  const pendingMatchCounts = new Map<string, number>();
  const venueIdsByTournament = new Map<string, string[]>();
  const pendingScores: PendingScoreMatch[] = [];

  if (ids.length > 0) {
    const inProgressIds = tournaments.filter((t) => t.status === "in_progress").map((t) => t.id);

    const [partsRes, venuesRes, matchesRes] = await Promise.all([
      supabase
        .from("tournament_participants")
        .select("tournament_id, status, withdrawn")
        .in("tournament_id", ids),
      supabase.from("tournament_venues").select("tournament_id, venue_id").in("tournament_id", ids),
      inProgressIds.length > 0
        ? supabase
            .from("matches")
            .select("id, tournament_id, round, stage, p1_id, p2_id")
            .in("tournament_id", inProgressIds)
            .eq("outcome", "pending")
            .not("p1_id", "is", null)
            .not("p2_id", "is", null)
            .order("round", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    for (const p of (partsRes.data ?? []) as Array<{
      tournament_id: string;
      status: "pending" | "approved" | "rejected";
      withdrawn: boolean;
    }>) {
      if (p.status === "approved" && !p.withdrawn) {
        approvedCounts.set(p.tournament_id, (approvedCounts.get(p.tournament_id) ?? 0) + 1);
      } else if (p.status === "pending") {
        pendingAppCounts.set(p.tournament_id, (pendingAppCounts.get(p.tournament_id) ?? 0) + 1);
      }
    }

    for (const v of (venuesRes.data ?? []) as Array<{
      tournament_id: string;
      venue_id: string;
    }>) {
      const arr = venueIdsByTournament.get(v.tournament_id) ?? [];
      arr.push(v.venue_id);
      venueIdsByTournament.set(v.tournament_id, arr);
    }

    const pendingMatches = (matchesRes.data ?? []) as Array<{
      id: string;
      tournament_id: string;
      round: number | null;
      stage: MatchStage | null;
      p1_id: string;
      p2_id: string;
    }>;
    for (const m of pendingMatches) {
      pendingMatchCounts.set(m.tournament_id, (pendingMatchCounts.get(m.tournament_id) ?? 0) + 1);
    }

    // Resolve player names for the score queue (cap the visible queue at 30
    // rows — the counter still reflects everything).
    const queue = pendingMatches.slice(0, 30);
    const playerIds = Array.from(new Set(queue.flatMap((m) => [m.p1_id, m.p2_id])));
    const nameById = new Map<string, string | null>();
    if (playerIds.length > 0) {
      const { data: basics } = (await supabase
        .from("public_player_basic")
        .select("id, display_name")
        .in("id", playerIds)) as {
        data: Array<{ id: string; display_name: string | null }> | null;
      };
      for (const b of basics ?? []) nameById.set(b.id, b.display_name);
    }
    for (const m of queue) {
      const t = tournamentById.get(m.tournament_id);
      if (!t) continue;
      pendingScores.push({
        match_id: m.id,
        tournament_id: m.tournament_id,
        tournament_name: t.name,
        tournament_is_mine: t.owner_id === userId,
        round: m.round,
        stage: m.stage,
        p1_name: nameById.get(m.p1_id) ?? null,
        p2_name: nameById.get(m.p2_id) ?? null,
      });
    }
  }

  // Organizer display names.
  const organizerIds = Array.from(new Set(tournaments.map((t) => t.owner_id)));
  const organizerNameById = new Map<string, string | null>();
  if (organizerIds.length > 0) {
    const { data: basics } = (await supabase
      .from("public_player_basic")
      .select("id, display_name")
      .in("id", organizerIds)) as {
      data: Array<{ id: string; display_name: string | null }> | null;
    };
    for (const b of basics ?? []) organizerNameById.set(b.id, b.display_name);
  }

  return {
    ok: true,
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      format: t.format,
      surface: t.surface,
      starts_on: t.starts_on,
      start_time: t.start_time,
      ends_on: t.ends_on,
      registration_deadline: t.registration_deadline,
      max_participants: t.max_participants,
      entry_fee_byn: t.entry_fee_byn,
      privacy: t.privacy,
      application_mode: t.application_mode,
      status: t.status,
      draw_method: t.draw_method,
      prizes_description: t.prizes_description,
      match_rules: t.match_rules,
      third_place_match: t.third_place_match,
      branding: tournamentBrandingFromRow(t.branding),
      created_at: t.created_at,
      organizer_id: t.owner_id,
      organizer_name: organizerNameById.get(t.owner_id) ?? null,
      is_mine: t.owner_id === userId,
      participants_count: approvedCounts.get(t.id) ?? 0,
      pending_applications: pendingAppCounts.get(t.id) ?? 0,
      pending_matches: pendingMatchCounts.get(t.id) ?? 0,
      venue_ids: venueIdsByTournament.get(t.id) ?? [],
    })),
    pendingScores,
  };
}
