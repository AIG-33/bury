"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TournamentFormat,
  TournamentStatus,
  Surface,
  Privacy,
  MatchRules,
} from "@/lib/tournaments/schema";

/**
 * Distinct list of cities that have at least one venue. Used to build the
 * city filter dropdown on `/tournaments`. Belarus-only (`country = 'BY'`).
 */
export async function loadVenueCities(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("venues")
    .select("city")
    .eq("country", "BY")
    .not("city", "is", null)
    .order("city", { ascending: true })) as {
    data: Array<{ city: string | null }> | null;
  };
  const seen = new Set<string>();
  for (const v of data ?? []) {
    if (v.city) seen.add(v.city);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, "ru"));
}

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
  entry_fee_byn: number | null;
  participants_count: number;
  privacy: Privacy;
  status: TournamentStatus;
  organizer_name: string | null;
  match_rules: MatchRules;
  venues: PublicTournamentVenue[];
};

/**
 * View filter for the public tournament catalogue.
 *
 *   "all"           → render the page as 3 sections (registration → upcoming → finished),
 *                     no DB-level status filter
 *   "registration"  → only open-for-registration ones
 *   "upcoming"      → draft + registration (legacy single-tab view)
 *   "in_progress"   → currently running
 *   "finished"      → finished
 */
export type PublicTournamentStatusFilter =
  | "all"
  | "registration"
  | "upcoming"
  | "in_progress"
  | "finished";

export async function loadPublicTournaments(opts: {
  status?: PublicTournamentStatusFilter;
  format?: TournamentFormat | null;
  surface?: Surface | null;
  /** "free" → entry_fee_byn IS NULL OR 0; "paid" → > 0; null/undefined → any. */
  fee?: "free" | "paid" | null;
  /** Post-filter on `venues.city` after the join — string match. */
  city?: string | null;
}): Promise<PublicTournamentRow[]> {
  const supabase = await createSupabaseServerClient();
  // Coach name is resolved separately via `public_profile_basic` because
  // `profiles_self_read` RLS would otherwise make every owner show as
  // "—" for anonymous viewers.
  let query = supabase
    .from("tournaments")
    .select(
      "id, owner_id, name, description, format, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_byn, privacy, status, match_rules",
    )
    .eq("privacy", "public")
    .order("starts_on", { ascending: true });

  if (opts.status === "registration") {
    query = query.eq("status", "registration");
  } else if (opts.status === "upcoming") {
    query = query.in("status", ["draft", "registration"]);
  } else if (opts.status === "in_progress") {
    query = query.eq("status", "in_progress");
  } else if (opts.status === "finished") {
    query = query.eq("status", "finished");
  }
  // "all" → no status filter; page splits the rows into sections itself.

  if (opts.format) query = query.eq("format", opts.format);
  if (opts.surface) query = query.eq("surface", opts.surface);
  if (opts.fee === "free") {
    // Postgrest's `or()` chain — entry_fee_byn IS NULL OR equals 0.
    query = query.or("entry_fee_byn.is.null,entry_fee_byn.eq.0");
  } else if (opts.fee === "paid") {
    query = query.gt("entry_fee_byn", 0);
  }

  const { data: rows } = (await query) as {
    data: Array<{
      id: string;
      owner_id: string;
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
      status: TournamentStatus;
      match_rules: MatchRules;
    }> | null;
  };

  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id)));
  const { data: ownerRows } = (await supabase
    .from("public_profile_basic")
    .select("id, display_name")
    .in("id", ownerIds)) as {
    data: Array<{ id: string; display_name: string | null }> | null;
  };
  const ownerNameById = new Map((ownerRows ?? []).map((o) => [o.id, o.display_name] as const));
  const [{ data: counts }, { data: tvs }] = await Promise.all([
    supabase
      .from("tournament_participants")
      .select("tournament_id, status, withdrawn")
      .in("tournament_id", ids) as unknown as Promise<{
      data: Array<{
        tournament_id: string;
        status: "pending" | "approved" | "rejected";
        withdrawn: boolean;
      }> | null;
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
    if (p.status === "approved" && !p.withdrawn) {
      cnt.set(p.tournament_id, (cnt.get(p.tournament_id) ?? 0) + 1);
    }
  }
  const venuesByT = new Map<string, PublicTournamentVenue[]>();
  for (const v of tvs ?? []) {
    const ref = Array.isArray(v.venues) ? v.venues[0] : v.venues;
    if (!ref) continue;
    const arr = venuesByT.get(v.tournament_id) ?? [];
    arr.push({ id: ref.id, name: ref.name, city: ref.city });
    venuesByT.set(v.tournament_id, arr);
  }

  const built: PublicTournamentRow[] = rows.map((r) => ({
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
    entry_fee_byn: r.entry_fee_byn,
    participants_count: cnt.get(r.id) ?? 0,
    privacy: r.privacy,
    status: r.status,
    organizer_name: ownerNameById.get(r.owner_id) ?? null,
    match_rules: r.match_rules,
    venues: venuesByT.get(r.id) ?? [],
  }));

  // City filter is applied in-memory because `tournament_venues.venues.city`
  // can't be used as a filter on a child relation in PostgREST without the
  // `!inner` join hint that we've not declared here. The page set is small
  // (typically <100 rows), so the cost is negligible.
  if (opts.city) {
    return built.filter((t) => t.venues.some((v) => v.city === opts.city));
  }
  return built;
}

export type PublicTournamentDetail = {
  tournament: PublicTournamentRow;
  participants: Array<{
    id: string;
    name: string | null;
    seed: number | null;
    elo: number;
    withdrawn: boolean;
    external_rating: {
      source: "liga_tennisa";
      external_elo: number;
      external_url: string;
      display_tier: string;
      is_calibrating_singles: boolean;
    } | null;
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
      "id, owner_id, name, description, format, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_byn, privacy, status, match_rules",
    )
    .eq("id", tournamentId)
    .maybeSingle()) as {
    data: {
      id: string;
      owner_id: string;
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
      status: TournamentStatus;
      match_rules: MatchRules;
    } | null;
  };

  if (!row) return null;

  // Organizer name via the RLS-bypassing public projection (the raw
  // `profiles` table is self-only).
  const { data: organizerBasic } = (await supabase
    .from("public_profile_basic")
    .select("display_name")
    .eq("id", row.owner_id)
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
      .select("player_id, seed, status, withdrawn")
      .eq("tournament_id", tournamentId)
      .eq("status", "approved")
      .order("seed", { ascending: true, nullsFirst: false }) as unknown as Promise<{
      data: Array<{
        player_id: string;
        seed: number | null;
        status: "pending" | "approved" | "rejected";
        withdrawn: boolean;
      }> | null;
    }>,
    supabase
      .from("matches")
      .select("id, round, bracket_slot, p1_id, p2_id, winner_side, sets, outcome, scheduled_at")
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
        sets: Array<{
          p1?: number;
          p2?: number;
          p1_games?: number;
          p2_games?: number;
          tb_p1?: number | null;
          tb_p2?: number | null;
          tiebreak_p1?: number | null;
          tiebreak_p2?: number | null;
        }> | null;
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
  const extByPlayer = new Map<string, PublicTournamentDetail["participants"][number]["external_rating"]>();
  if (playerIds.length > 0) {
    const [{ data: basics }, { data: extRows }] = await Promise.all([
      supabase
        .from("public_player_basic")
        .select("id, display_name, current_elo")
        .in("id", playerIds) as unknown as Promise<{ data: Basic[] | null }>,
      supabase
        .from("external_ratings")
        .select("player_id, external_elo, external_url, display_tier, is_calibrating_singles")
        .eq("source", "liga_tennisa")
        .in("player_id", playerIds) as unknown as Promise<{
        data: Array<{
          player_id: string;
          external_elo: number;
          external_url: string;
          display_tier: string;
          is_calibrating_singles: boolean;
        }> | null;
      }>,
    ]);
    basicById = new Map((basics ?? []).map((b) => [b.id, b] as const));
    for (const r of extRows ?? []) {
      extByPlayer.set(r.player_id, {
        source: "liga_tennisa",
        external_elo: r.external_elo,
        external_url: r.external_url,
        display_tier: r.display_tier,
        is_calibrating_singles: r.is_calibrating_singles,
      });
    }
  }

  const participants = (parts ?? []).map((p) => {
    const b = basicById.get(p.player_id);
    return {
      id: p.player_id,
      name: b?.display_name ?? null,
      seed: p.seed,
      elo: b?.current_elo ?? 1000,
      withdrawn: p.withdrawn,
      external_rating: extByPlayer.get(p.player_id) ?? null,
    };
  });

  const matchesOut = (matches ?? []).map((m) => {
    const winner_id = m.winner_side === "p1" ? m.p1_id : m.winner_side === "p2" ? m.p2_id : null;
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
      p1_name: m.p1_id ? (basicById.get(m.p1_id)?.display_name ?? null) : null,
      p2_name: m.p2_id ? (basicById.get(m.p2_id)?.display_name ?? null) : null,
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
      entry_fee_byn: row.entry_fee_byn,
      participants_count,
      privacy: row.privacy,
      status: row.status,
      organizer_name: organizerBasic?.display_name ?? null,
      match_rules: row.match_rules,
      venues,
    },
    participants,
    matches: matchesOut,
  };
}
