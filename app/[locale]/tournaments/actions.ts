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
  // Coach name is resolved separately via `public_profile_basic` because
  // `profiles_self_read` RLS would otherwise make every owner show as
  // "—" for anonymous viewers.
  let query = supabase
    .from("tournaments")
    .select(
      "id, owner_coach_id, name, description, format, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_pln, privacy, status, match_rules",
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
      owner_coach_id: string;
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
    }> | null;
  };

  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const ownerIds = Array.from(new Set(rows.map((r) => r.owner_coach_id)));
  const { data: ownerRows } = (await supabase
    .from("public_profile_basic")
    .select("id, display_name")
    .in("id", ownerIds)) as {
    data: Array<{ id: string; display_name: string | null }> | null;
  };
  const ownerNameById = new Map(
    (ownerRows ?? []).map((o) => [o.id, o.display_name] as const),
  );
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
    coach_name: ownerNameById.get(r.owner_coach_id) ?? null,
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

  // No `privacy='public'` filter: visibility is enforced by `tournaments_read`
  // RLS (public OR owner OR participant OR admin), which is correct for
  // 'club' tournaments — owner / participants should see their results page.
  const { data: row } = (await supabase
    .from("tournaments")
    .select(
      "id, owner_coach_id, name, description, format, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_pln, privacy, status, match_rules",
    )
    .eq("id", tournamentId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          owner_coach_id: string;
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
        }
      | null;
  };

  if (!row) return null;

  // Coach name via the RLS-bypassing public projection (the raw `profiles`
  // table is self-only).
  const { data: coachBasic } = (await supabase
    .from("public_profile_basic")
    .select("display_name")
    .eq("id", row.owner_coach_id)
    .maybeSingle()) as { data: { display_name: string | null } | null };

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

  // Real columns are `bracket_slot` (not bracket_position) and
  // `winner_side` (not winner_id). Anything else throws "column does
  // not exist" and the page renders an empty matches list.
  const [{ data: parts }, { data: matches }] = await Promise.all([
    supabase
      .from("tournament_participants")
      .select("player_id, seed, withdrawn")
      .eq("tournament_id", tournamentId)
      .order("seed", { ascending: true, nullsFirst: false }) as unknown as Promise<{
      data: Array<{
        player_id: string;
        seed: number | null;
        withdrawn: boolean;
      }> | null;
    }>,
    supabase
      .from("matches")
      .select(
        "id, round, bracket_slot, p1_id, p2_id, winner_side, sets, outcome, scheduled_at",
      )
      .eq("tournament_id", tournamentId)
      .order("round", { ascending: true })
      .order("bracket_slot", { ascending: true }) as unknown as Promise<{
      data: Array<{
        id: string;
        round: number | null;
        bracket_slot: number | null;
        p1_id: string | null;
        p2_id: string | null;
        winner_side: "p1" | "p2" | null;
        sets:
          | Array<{
              p1?: number;
              p2?: number;
              p1_games?: number;
              p2_games?: number;
              tb_p1?: number | null;
              tb_p2?: number | null;
              tiebreak_p1?: number | null;
              tiebreak_p2?: number | null;
            }>
          | null;
        outcome: string;
        scheduled_at: string | null;
      }> | null;
    }>,
  ]);

  // Player names + Elo via RLS-bypassing projection.
  const playerIds = Array.from(
    new Set(
      [
        ...(parts ?? []).map((p) => p.player_id),
        ...(matches ?? []).flatMap((m) => [m.p1_id, m.p2_id]),
      ].filter((x): x is string => !!x),
    ),
  );
  type Basic = {
    id: string;
    display_name: string | null;
    current_elo: number | null;
  };
  let basicById = new Map<string, Basic>();
  if (playerIds.length > 0) {
    const { data: basics } = (await supabase
      .from("public_player_basic")
      .select("id, display_name, current_elo")
      .in("id", playerIds)) as { data: Basic[] | null };
    basicById = new Map((basics ?? []).map((b) => [b.id, b] as const));
  }

  const participants = (parts ?? []).map((p) => {
    const b = basicById.get(p.player_id);
    return {
      id: p.player_id,
      name: b?.display_name ?? null,
      seed: p.seed,
      elo: b?.current_elo ?? 1000,
      withdrawn: p.withdrawn,
    };
  });

  const matchesOut = (matches ?? []).map((m) => {
    const winner_id =
      m.winner_side === "p1" ? m.p1_id : m.winner_side === "p2" ? m.p2_id : null;
    // Normalise sets to the `{p1, p2, tb_p1, tb_p2}` shape the UI uses.
    const sets =
      m.sets == null
        ? null
        : m.sets.map((s) => ({
            p1: (s.p1 ?? s.p1_games ?? 0) as number,
            p2: (s.p2 ?? s.p2_games ?? 0) as number,
            tb_p1: (s.tb_p1 ?? s.tiebreak_p1 ?? null) as number | null,
            tb_p2: (s.tb_p2 ?? s.tiebreak_p2 ?? null) as number | null,
          }));
    return {
      id: m.id,
      round: m.round,
      bracket_position: m.bracket_slot,
      p1_id: m.p1_id,
      p2_id: m.p2_id,
      p1_name: m.p1_id ? basicById.get(m.p1_id)?.display_name ?? null : null,
      p2_name: m.p2_id ? basicById.get(m.p2_id)?.display_name ?? null : null,
      winner_id,
      sets,
      outcome: m.outcome,
      scheduled_at: m.scheduled_at,
    };
  });

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
      coach_name: coachBasic?.display_name ?? null,
      match_rules: row.match_rules,
      venues,
    },
    participants,
    matches: matchesOut,
  };
}
