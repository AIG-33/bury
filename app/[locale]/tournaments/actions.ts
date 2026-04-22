"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TournamentFormat,
  TournamentStatus,
  Surface,
  Privacy,
  MatchRules,
} from "@/lib/tournaments/schema";

export type PublicTournamentVenue = {
  id: string;
  name: string;
  city: string | null;
};

export type PublicTournamentRow = {
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
  entry_fee_pln: number | null;
  participants_count: number;
  privacy: Privacy;
  status: TournamentStatus;
  coach_name: string | null;
  match_rules: MatchRules;
  venues: PublicTournamentVenue[];
};

export async function loadPublicTournaments(opts: {
  status?: "upcoming" | "in_progress" | "finished";
}): Promise<PublicTournamentRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("tournaments")
    .select(
      "id, name, description, format, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_pln, privacy, status, " +
        "match_rules, profiles!tournaments_owner_coach_id_fkey(display_name)",
    )
    .eq("privacy", "public")
    .order("starts_on", { ascending: true });

  if (opts.status === "upcoming") {
    query = query.in("status", ["draft", "registration"]);
  } else if (opts.status === "in_progress") {
    query = query.eq("status", "in_progress");
  } else if (opts.status === "finished") {
    query = query.eq("status", "finished");
  }

  const { data: rows } = (await query) as {
    data: Array<{
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
      entry_fee_pln: number | null;
      privacy: Privacy;
      status: TournamentStatus;
      match_rules: MatchRules;
      profiles: { display_name: string | null } | null;
    }> | null;
  };

  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [{ data: counts }, { data: tvs }] = await Promise.all([
    supabase
      .from("tournament_participants")
      .select("tournament_id, withdrawn")
      .in("tournament_id", ids) as unknown as Promise<{
      data: Array<{ tournament_id: string; withdrawn: boolean }> | null;
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
  const cnt = new Map<string, number>();
  for (const p of counts ?? []) {
    if (!p.withdrawn) cnt.set(p.tournament_id, (cnt.get(p.tournament_id) ?? 0) + 1);
  }
  const venuesByT = new Map<string, PublicTournamentVenue[]>();
  for (const v of tvs ?? []) {
    const ref = Array.isArray(v.venues) ? v.venues[0] : v.venues;
    if (!ref) continue;
    const arr = venuesByT.get(v.tournament_id) ?? [];
    arr.push({ id: ref.id, name: ref.name, city: ref.city });
    venuesByT.set(v.tournament_id, arr);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    format: r.format,
    surface: r.surface,
    starts_on: r.starts_on,
    start_time: r.start_time,
    ends_on: r.ends_on,
    registration_deadline: r.registration_deadline,
    max_participants: r.max_participants,
    entry_fee_pln: r.entry_fee_pln,
    participants_count: cnt.get(r.id) ?? 0,
    privacy: r.privacy,
    status: r.status,
    coach_name: r.profiles?.display_name ?? null,
    match_rules: r.match_rules,
    venues: venuesByT.get(r.id) ?? [],
  }));
}

export type PublicTournamentDetail = {
  tournament: PublicTournamentRow;
  participants: Array<{
    id: string;
    name: string | null;
    seed: number | null;
    elo: number;
    withdrawn: boolean;
  }>;
  matches: Array<{
    id: string;
    round: number | null;
    bracket_position: number | null;
    p1_name: string | null;
    p2_name: string | null;
    winner_id: string | null;
    p1_id: string | null;
    p2_id: string | null;
    sets: Array<{ p1: number; p2: number; tb_p1?: number | null; tb_p2?: number | null }> | null;
    outcome: string;
    scheduled_at: string | null;
  }>;
};

export async function loadPublicTournamentDetail(
  tournamentId: string,
): Promise<PublicTournamentDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: row } = (await supabase
    .from("tournaments")
    .select(
      "id, name, description, format, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_pln, privacy, status, " +
        "match_rules, profiles!tournaments_owner_coach_id_fkey(display_name)",
    )
    .eq("id", tournamentId)
    .eq("privacy", "public")
    .maybeSingle()) as {
    data:
      | {
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
          entry_fee_pln: number | null;
          privacy: Privacy;
          status: TournamentStatus;
          match_rules: MatchRules;
          profiles: { display_name: string | null } | null;
        }
      | null;
  };

  if (!row) return null;

  const { data: tvs } = (await supabase
    .from("tournament_venues")
    .select("venues!inner(id, name, city)")
    .eq("tournament_id", tournamentId)) as {
    data: Array<{
      venues:
        | { id: string; name: string; city: string | null }
        | Array<{ id: string; name: string; city: string | null }>;
    }> | null;
  };
  const venues: PublicTournamentVenue[] = (tvs ?? [])
    .map((v) => (Array.isArray(v.venues) ? v.venues[0] : v.venues))
    .filter((v): v is { id: string; name: string; city: string | null } => v != null)
    .map((v) => ({ id: v.id, name: v.name, city: v.city }));

  const [{ data: parts }, { data: matches }] = await Promise.all([
    supabase
      .from("tournament_participants")
      .select("player_id, seed, withdrawn, profiles!inner(id, display_name, current_elo)")
      .eq("tournament_id", tournamentId)
      .order("seed", { ascending: true, nullsFirst: false }) as unknown as Promise<{
      data: Array<{
        player_id: string;
        seed: number | null;
        withdrawn: boolean;
        profiles:
          | { id: string; display_name: string | null; current_elo: number }
          | Array<{ id: string; display_name: string | null; current_elo: number }>;
      }> | null;
    }>,
    supabase
      .from("matches")
      .select(
        "id, round, bracket_position, p1_id, p2_id, winner_id, sets, outcome, scheduled_at",
      )
      .eq("tournament_id", tournamentId)
      .order("round", { ascending: true })
      .order("bracket_position", { ascending: true }) as unknown as Promise<{
      data: Array<{
        id: string;
        round: number | null;
        bracket_position: number | null;
        p1_id: string | null;
        p2_id: string | null;
        winner_id: string | null;
        sets: Array<{ p1: number; p2: number; tb_p1?: number | null; tb_p2?: number | null }> | null;
        outcome: string;
        scheduled_at: string | null;
      }> | null;
    }>,
  ]);

  const participants = (parts ?? []).map((p) => {
    const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return {
      id: p.player_id,
      name: prof?.display_name ?? null,
      seed: p.seed,
      elo: prof?.current_elo ?? 1000,
      withdrawn: p.withdrawn,
    };
  });

  const nameIndex = new Map(participants.map((p) => [p.id, p.name] as const));
  const matchesOut = (matches ?? []).map((m) => ({
    id: m.id,
    round: m.round,
    bracket_position: m.bracket_position,
    p1_id: m.p1_id,
    p2_id: m.p2_id,
    p1_name: m.p1_id ? nameIndex.get(m.p1_id) ?? null : null,
    p2_name: m.p2_id ? nameIndex.get(m.p2_id) ?? null : null,
    winner_id: m.winner_id,
    sets: m.sets,
    outcome: m.outcome,
    scheduled_at: m.scheduled_at,
  }));

  // Headcount for the public row shape.
  const participants_count = participants.filter((p) => !p.withdrawn).length;

  return {
    tournament: {
      id: row.id,
      name: row.name,
      description: row.description,
      format: row.format,
      surface: row.surface,
      starts_on: row.starts_on,
      start_time: row.start_time,
      ends_on: row.ends_on,
      registration_deadline: row.registration_deadline,
      max_participants: row.max_participants,
      entry_fee_pln: row.entry_fee_pln,
      participants_count,
      privacy: row.privacy,
      status: row.status,
      coach_name: row.profiles?.display_name ?? null,
      match_rules: row.match_rules,
      venues,
    },
    participants,
    matches: matchesOut,
  };
}
