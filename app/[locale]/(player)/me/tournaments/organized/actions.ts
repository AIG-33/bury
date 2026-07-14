"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { enqueue } from "@/lib/notifications/outbox";
import type { Locale } from "@/lib/notifications/templates";
import {
  TournamentFormSchema,
  ScoreFormSchema,
  AddParticipantSchema,
  GenerateGroupsSchema,
  CloseGroupsSchema,
  MoveToGroupSchema,
  type TournamentFormat,
  type TournamentStatus,
  type SeedingMethod,
  type Privacy,
  type ApplicationMode,
  type Surface,
  type MatchRules,
  type MatchStage,
} from "@/lib/tournaments/schema";
import { canSetParticipantStatus } from "@/lib/tournaments/applications";
import {
  buildRoundRobinSchedule,
  buildSingleEliminationBracket,
  computeRoundRobinStandings,
  computeWinnerSide,
  distributeIntoGroups,
  orderQualifiersForPlayoff,
  type Player as DrawPlayer,
  type StandingRow,
  type GroupQualifier,
} from "@/lib/tournaments/draw";
import { recalcMatchElo } from "@/lib/rating/recalc";
import { recalcClubRatingsForMatch } from "@/lib/rating/club-recalc";
import { validateScoreAgainstRules } from "@/lib/tournaments/score-validation";
import {
  TournamentBrandingSchema,
  tournamentBrandingFromRow,
  hasBranding,
  type TournamentBranding,
} from "@/lib/validators/tournament-branding";

// =============================================================================
// Types returned to the UI
// =============================================================================

export type TournamentVenueRef = {
  id: string;
  name: string;
  city: string | null;
};

export type TournamentRow = {
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
  club_id: string | null;
  status: TournamentStatus;
  draw_method: SeedingMethod | null;
  prizes_description: string | null;
  match_rules: MatchRules;
  participants_count: number;
  pending_count: number;
  venues: TournamentVenueRef[];
  /** Public-page branding (logo, banner, colors, sponsors, …). Always a
   * well-formed object — legacy rows parse to the defaults. */
  branding: TournamentBranding;
  created_at: string;
  // Hybrid (group + playoff) fields. Null on tournaments where they don't apply.
  groups_count: number | null;
  advance_per_group: number | null;
  playoff_size: number | null;
  third_place_match: boolean;
};

export type GroupRow = {
  id: string;
  name: string;
  position: number;
};

export type VenueOption = {
  id: string;
  name: string;
  city: string | null;
};

export type ParticipantStatus = "pending" | "approved" | "rejected";

export type ParticipantRow = {
  id: string;
  player_id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number;
  seed: number | null;
  status: ParticipantStatus;
  withdrawn: boolean;
  registered_at: string;
  group_id: string | null;
};

export type MatchRow = {
  id: string;
  round: number | null;
  bracket_slot: number | null;
  p1_id: string | null;
  p2_id: string | null;
  p1_name: string | null;
  p2_name: string | null;
  winner_side: "p1" | "p2" | null;
  outcome: string;
  sets: Array<{ p1: number; p2: number; tb_p1?: number | null; tb_p2?: number | null }> | null;
  scheduled_at: string | null;
  played_at: string | null;
  stage: MatchStage | null;
  group_id: string | null;
};

export type PlayerOption = {
  id: string;
  display_name: string | null;
  current_elo: number;
};

type SaveResult = { ok: true; id: string } | { ok: false; error: string };

// =============================================================================
// Auth — must be authenticated. Tournaments are no longer a coach-only feature.
// =============================================================================

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  return { ok: true as const, supabase, userId: user.id };
}

// =============================================================================
// List + detail loaders
// =============================================================================

export async function loadOrganizedTournaments(): Promise<
  { ok: true; tournaments: TournamentRow[] } | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: rows } = (await supabase
    .from("tournaments")
    .select(
      "id, name, description, format, surface, starts_on, start_time, ends_on, " +
        "registration_deadline, max_participants, entry_fee_byn, privacy, application_mode, club_id, status, " +
        "draw_method, prizes_description, match_rules, branding, created_at, " +
        "groups_count, advance_per_group, playoff_size, third_place_match",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })) as {
    data: Array<
      Omit<TournamentRow, "participants_count" | "pending_count" | "venues" | "branding"> & {
        branding: unknown;
      }
    > | null;
  };

  const tournaments = rows ?? [];
  const ids = tournaments.map((t) => t.id);
  const approvedCounts = new Map<string, number>();
  const pendingCounts = new Map<string, number>();
  const venuesByTournament = new Map<string, TournamentVenueRef[]>();
  if (ids.length > 0) {
    const [partsRes, venuesRes] = await Promise.all([
      supabase
        .from("tournament_participants")
        .select("tournament_id, status, withdrawn")
        .in("tournament_id", ids),
      supabase
        .from("tournament_venues")
        .select("tournament_id, venues!inner(id, name, city)")
        .in("tournament_id", ids),
    ]);
    for (const p of (partsRes.data ?? []) as Array<{
      tournament_id: string;
      status: ParticipantStatus;
      withdrawn: boolean;
    }>) {
      if (p.status === "approved" && !p.withdrawn) {
        approvedCounts.set(p.tournament_id, (approvedCounts.get(p.tournament_id) ?? 0) + 1);
      } else if (p.status === "pending") {
        pendingCounts.set(p.tournament_id, (pendingCounts.get(p.tournament_id) ?? 0) + 1);
      }
    }
    for (const v of (venuesRes.data ?? []) as Array<{
      tournament_id: string;
      venues:
        | { id: string; name: string; city: string | null }
        | Array<{ id: string; name: string; city: string | null }>;
    }>) {
      const ref = Array.isArray(v.venues) ? v.venues[0] : v.venues;
      if (!ref) continue;
      const arr = venuesByTournament.get(v.tournament_id) ?? [];
      arr.push({ id: ref.id, name: ref.name, city: ref.city });
      venuesByTournament.set(v.tournament_id, arr);
    }
  }

  return {
    ok: true,
    tournaments: tournaments.map((t) => ({
      ...t,
      branding: tournamentBrandingFromRow(t.branding),
      participants_count: approvedCounts.get(t.id) ?? 0,
      pending_count: pendingCounts.get(t.id) ?? 0,
      venues: venuesByTournament.get(t.id) ?? [],
    })),
  };
}

// ─── Lightweight venues catalogue for the create/edit form ──────────────────
export async function loadVenueOptions(): Promise<VenueOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("venues")
    .select("id, name, city")
    .order("name", { ascending: true })) as {
    data: Array<VenueOption> | null;
  };
  return data ?? [];
}

export type ClubOption = { id: string; name: string };

/**
 * Clubs the current user owns or co-administers — used to optionally link a
 * tournament to a club (which feeds that club's internal rating).
 */
export async function loadAdministrableClubs(): Promise<ClubOption[]> {
  const auth = await requireUser();
  if (!auth.ok) return [];
  const { supabase, userId } = auth;

  const { data: owned } = (await supabase
    .from("clubs")
    .select("id, name")
    .eq("owner_id", userId)) as { data: ClubOption[] | null };

  const { data: adminRows } = (await supabase
    .from("club_members")
    .select("clubs!inner(id, name)")
    .eq("user_id", userId)
    .eq("role", "admin")
    .eq("status", "approved")) as {
    data: Array<{ clubs: ClubOption | ClubOption[] }> | null;
  };

  const byId = new Map<string, ClubOption>();
  for (const c of owned ?? []) byId.set(c.id, c);
  for (const r of adminRows ?? []) {
    const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs;
    if (c) byId.set(c.id, c);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadTournamentDetail(tournamentId: string): Promise<
  | {
      ok: true;
      tournament: TournamentRow;
      participants: ParticipantRow[];
      matches: MatchRow[];
      playerOptions: PlayerOption[];
      groups: GroupRow[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: t } = (await supabase
    .from("tournaments")
    .select(
      "id, owner_id, name, description, format, surface, starts_on, start_time, " +
        "ends_on, registration_deadline, max_participants, entry_fee_byn, privacy, application_mode, club_id, status, " +
        "draw_method, prizes_description, match_rules, branding, created_at, " +
        "groups_count, advance_per_group, playoff_size, third_place_match",
    )
    .eq("id", tournamentId)
    .single()) as {
    data:
      | (Omit<TournamentRow, "participants_count" | "pending_count" | "venues" | "branding"> & {
          owner_id: string;
          branding: unknown;
        })
      | null;
  };
  if (!t) return { ok: false, error: "not_found" };
  if (t.owner_id !== userId) return { ok: false, error: "not_owner" };

  const { data: tvenues } = (await supabase
    .from("tournament_venues")
    .select("venues!inner(id, name, city)")
    .eq("tournament_id", tournamentId)) as {
    data: Array<{
      venues:
        | { id: string; name: string; city: string | null }
        | Array<{ id: string; name: string; city: string | null }>;
    }> | null;
  };
  const venues: TournamentVenueRef[] = (tvenues ?? [])
    .map((v) => (Array.isArray(v.venues) ? v.venues[0] : v.venues))
    .filter((v): v is { id: string; name: string; city: string | null } => v != null)
    .map((v) => ({ id: v.id, name: v.name, city: v.city }));

  // NOTE: no `profiles` join — use the RLS-bypassing public projection.
  const { data: parts } = (await supabase
    .from("tournament_participants")
    .select("id, player_id, seed, status, withdrawn, registered_at, group_id")
    .eq("tournament_id", tournamentId)
    .order("status", { ascending: true })
    .order("seed", { ascending: true, nullsFirst: false })
    .order("registered_at", { ascending: true })) as {
    data: Array<{
      id: string;
      player_id: string;
      seed: number | null;
      status: ParticipantStatus;
      withdrawn: boolean;
      registered_at: string;
      group_id: string | null;
    }> | null;
  };

  const { data: groupRows } = (await supabase
    .from("tournament_groups")
    .select("id, name, position")
    .eq("tournament_id", tournamentId)
    .order("position", { ascending: true })) as {
    data: Array<GroupRow> | null;
  };
  const groups: GroupRow[] = groupRows ?? [];

  const playerIds = Array.from(new Set((parts ?? []).map((p) => p.player_id)));
  type Basic = {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    current_elo: number | null;
  };
  let basicById = new Map<string, Basic>();
  if (playerIds.length > 0) {
    const { data: basics } = (await supabase
      .from("public_player_basic")
      .select("id, display_name, avatar_url, current_elo")
      .in("id", playerIds)) as { data: Basic[] | null };
    basicById = new Map((basics ?? []).map((b) => [b.id, b] as const));
  }

  const participants: ParticipantRow[] = (parts ?? []).map((p) => {
    const b = basicById.get(p.player_id);
    return {
      id: p.id,
      player_id: p.player_id,
      seed: p.seed,
      status: p.status,
      withdrawn: p.withdrawn,
      registered_at: p.registered_at,
      group_id: p.group_id,
      display_name: b?.display_name ?? null,
      avatar_url: b?.avatar_url ?? null,
      current_elo: b?.current_elo ?? 1000,
    };
  });

  const { data: ms } = (await supabase
    .from("matches")
    .select(
      "id, round, bracket_slot, p1_id, p2_id, winner_side, outcome, sets, scheduled_at, played_at, " +
        "stage, group_id",
    )
    .eq("tournament_id", tournamentId)
    .order("stage", { ascending: true, nullsFirst: true })
    .order("round", { ascending: true })
    .order("bracket_slot", { ascending: true })) as {
    data: Array<Omit<MatchRow, "p1_name" | "p2_name">> | null;
  };

  const nameById = new Map<string, string | null>();
  for (const p of participants) nameById.set(p.player_id, p.display_name);

  const matches: MatchRow[] = (ms ?? []).map((m) => ({
    ...m,
    p1_name: m.p1_id ? (nameById.get(m.p1_id) ?? null) : null,
    p2_name: m.p2_id ? (nameById.get(m.p2_id) ?? null) : null,
  }));

  // "Add participant" picker — exclude anyone with an existing (any-status) row.
  const registeredIds = new Set(participants.map((p) => p.player_id));
  const { data: pool } = (await supabase
    .from("public_player_basic")
    .select("id, display_name, current_elo")
    .eq("visible_in_leaderboard", true)
    .order("current_elo", { ascending: false })
    .limit(200)) as {
    data: Array<PlayerOption> | null;
  };
  const playerOptions = (pool ?? []).filter((p) => !registeredIds.has(p.id));

  const participants_count = participants.filter(
    (p) => p.status === "approved" && !p.withdrawn,
  ).length;
  const pending_count = participants.filter((p) => p.status === "pending").length;

  return {
    ok: true,
    tournament: {
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
      club_id: t.club_id ?? null,
      status: t.status,
      draw_method: t.draw_method,
      prizes_description: t.prizes_description,
      match_rules: t.match_rules,
      participants_count,
      pending_count,
      venues,
      branding: tournamentBrandingFromRow(t.branding),
      created_at: t.created_at,
      groups_count: t.groups_count,
      advance_per_group: t.advance_per_group,
      playoff_size: t.playoff_size,
      third_place_match: t.third_place_match,
    },
    participants,
    matches,
    playerOptions,
    groups,
  };
}

// =============================================================================
// Tournament create / update / status / delete
// =============================================================================

async function syncTournamentVenues(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tournamentId: string,
  venueIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Idempotent replace: drop everything, then re-insert the new set.
  const { error: delErr } = await supabase
    .from("tournament_venues")
    .delete()
    .eq("tournament_id", tournamentId);
  if (delErr) return { ok: false, error: delErr.message };

  const unique = Array.from(new Set(venueIds));
  if (unique.length === 0) return { ok: true };

  const rows = unique.map((venue_id) => ({
    tournament_id: tournamentId,
    venue_id,
  }));
  const { error: insErr } = await supabase.from("tournament_venues").insert(rows as never);
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true };
}

/**
 * True when the user owns the club or is an approved co-admin of it. Used to
 * gate linking a tournament to a club.
 */
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

/**
 * `brandingInput` (optional) — the public-page branding to apply to the new
 * tournament. Used by the duplicate / create-from-template flows so the copy
 * keeps the source's look (logo, banner, colors, sponsors). Plain creates
 * omit it and get the DB default (`{}` → default look).
 */
export async function createTournament(
  input: unknown,
  brandingInput?: unknown,
): Promise<SaveResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = TournamentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;

  let branding: TournamentBranding | null = null;
  if (brandingInput != null) {
    const parsedBranding = TournamentBrandingSchema.safeParse(brandingInput);
    if (!parsedBranding.success) return { ok: false, error: "branding_invalid" };
    if (hasBranding(parsedBranding.data)) branding = parsedBranding.data;
  }

  if (v.club_id && !(await userAdministersClub(supabase, userId, v.club_id))) {
    return { ok: false, error: "not_club_admin" };
  }

  const { data, error } = (await supabase
    .from("tournaments")
    .insert({
      owner_id: userId,
      name: v.name,
      description: v.description,
      format: v.format,
      surface: v.surface ?? null,
      starts_on: v.starts_on,
      start_time: v.start_time,
      ends_on: v.ends_on,
      registration_deadline: v.registration_deadline
        ? `${v.registration_deadline}T23:59:59Z`
        : null,
      max_participants: v.max_participants,
      entry_fee_byn: v.entry_fee_byn,
      privacy: v.privacy,
      application_mode: v.application_mode,
      club_id: v.club_id,
      draw_method: v.draw_method,
      prizes_description: v.prizes_description,
      match_rules: v.match_rules,
      third_place_match: v.format === "group_playoff" ? v.third_place_match : false,
      status: "draft",
      ...(branding ? { branding } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };

  const venueSync = await syncTournamentVenues(supabase, data.id, v.venue_ids);
  if (!venueSync.ok) return { ok: false, error: venueSync.error };

  revalidatePath("/me/tournaments/organized");
  revalidatePath("/me/tournaments");
  return { ok: true, id: data.id };
}

// Key-order-independent serialization: Postgres jsonb reorders object keys,
// so a naive JSON.stringify comparison against the form payload would always
// report "changed".
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export async function updateTournament(id: string, input: unknown): Promise<SaveResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = TournamentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;

  const { data: current } = (await supabase
    .from("tournaments")
    .select("id, owner_id, status, format, draw_method, match_rules, third_place_match")
    .eq("id", id)
    .single()) as {
    data: {
      id: string;
      owner_id: string;
      status: TournamentStatus;
      format: TournamentFormat;
      draw_method: SeedingMethod | null;
      match_rules: MatchRules;
      third_place_match: boolean;
    } | null;
  };
  if (!current) return { ok: false, error: "not_found" };
  if (current.owner_id !== userId) return { ok: false, error: "not_owner" };

  if (v.club_id && !(await userAdministersClub(supabase, userId, v.club_id))) {
    return { ok: false, error: "not_club_admin" };
  }

  // Once the draw exists (in_progress) or the tournament is over, changing
  // the format / seeding / match rules would silently invalidate played
  // matches and the bracket. Harmless edits (description, dates, fee,
  // privacy, venues, …) stay allowed.
  const locked = current.status === "in_progress" || current.status === "finished";
  if (locked) {
    const drawAffectingChanged =
      v.format !== current.format ||
      v.draw_method !== (current.draw_method ?? "rating") ||
      stableStringify(v.match_rules) !== stableStringify(current.match_rules) ||
      (v.format === "group_playoff" && v.third_place_match !== current.third_place_match);
    if (drawAffectingChanged) {
      return { ok: false, error: "locked_in_progress" };
    }
  }

  const { error } = await supabase
    .from("tournaments")
    .update({
      name: v.name,
      description: v.description,
      format: v.format,
      surface: v.surface ?? null,
      starts_on: v.starts_on,
      start_time: v.start_time,
      ends_on: v.ends_on,
      registration_deadline: v.registration_deadline
        ? `${v.registration_deadline}T23:59:59Z`
        : null,
      max_participants: v.max_participants,
      entry_fee_byn: v.entry_fee_byn,
      privacy: v.privacy,
      application_mode: v.application_mode,
      club_id: v.club_id,
      draw_method: v.draw_method,
      prizes_description: v.prizes_description,
      match_rules: v.match_rules,
      third_place_match: v.format === "group_playoff" ? v.third_place_match : false,
    } as never)
    .eq("id", id)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };

  const venueSync = await syncTournamentVenues(supabase, id, v.venue_ids);
  if (!venueSync.ok) return { ok: false, error: venueSync.error };

  revalidatePath(`/me/tournaments/organized/${id}`);
  revalidatePath("/me/tournaments/organized");
  return { ok: true, id };
}

/**
 * Manual status switch is intentionally limited to the registration phase:
 * draft ↔ registration. Everything past that flows through dedicated actions
 * (generateBracket / generateGroups → in_progress, setMatchScore → finished),
 * so allowing arbitrary jumps here would corrupt the bracket lifecycle.
 */
export async function setTournamentStatus(
  id: string,
  status: TournamentStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, status")
    .eq("id", id)
    .single()) as {
    data: { id: string; owner_id: string; status: TournamentStatus } | null;
  };
  if (!t) return { ok: false, error: "not_found" };
  if (t.owner_id !== userId) return { ok: false, error: "not_owner" };

  const allowed =
    (t.status === "draft" && status === "registration") ||
    (t.status === "registration" && status === "draft");
  if (!allowed) return { ok: false, error: "invalid_transition" };

  const { error } = await supabase
    .from("tournaments")
    .update({ status } as never)
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/me/tournaments/organized/${id}`);
  revalidatePath("/me/tournaments/organized");
  revalidatePath("/me/tournaments");
  revalidatePath("/tournaments");
  return { ok: true };
}

// Targeted privacy switch — used by the inline toggle on the organizer
// tournament detail page so owners can publish results to /matches
// without opening the full edit dialog.
export async function setTournamentPrivacy(
  id: string,
  privacy: Privacy,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  if (privacy !== "club" && privacy !== "public") {
    return { ok: false, error: "invalid_privacy" };
  }

  const { error } = await supabase
    .from("tournaments")
    .update({ privacy } as never)
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/me/tournaments/organized/${id}`);
  revalidatePath(`/tournaments/${id}`);
  revalidatePath("/me/tournaments/organized");
  revalidatePath("/tournaments");
  revalidatePath("/matches");
  return { ok: true };
}

export async function deleteTournament(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, status")
    .eq("id", id)
    .single()) as {
    data: { id: string; owner_id: string; status: TournamentStatus } | null;
  };
  if (!t) return { ok: false, error: "not_found" };
  if (t.owner_id !== userId) return { ok: false, error: "not_owner" };
  // A running tournament has live matches and pending Elo — cancel or finish
  // it first. Draft/registration/finished/cancelled can be deleted.
  if (t.status === "in_progress") {
    return { ok: false, error: "delete_locked_in_progress" };
  }

  const { error } = await supabase.from("tournaments").delete().eq("id", id).eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/tournaments/organized");
  return { ok: true };
}

// =============================================================================
// Participants — owner-side approval flow
// =============================================================================

/**
 * Owner-driven add: bypass the application step and create an already-approved
 * row. Used when the organizer enters players manually (e.g. local club) and
 * doesn't expect them to self-register.
 */
export async function addParticipant(input: unknown): Promise<SaveResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = AddParticipantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, status, max_participants")
    .eq("id", v.tournament_id)
    .single()) as {
    data: {
      id: string;
      owner_id: string;
      status: TournamentStatus;
      max_participants: number | null;
    } | null;
  };
  if (!t) return { ok: false, error: "tournament_not_found" };
  if (t.owner_id !== userId) return { ok: false, error: "not_owner" };
  if (t.status === "in_progress" || t.status === "finished") {
    return { ok: false, error: "tournament_locked" };
  }

  if (t.max_participants != null) {
    const { data: cnt } = (await supabase
      .from("tournament_participants")
      .select("id")
      .eq("tournament_id", v.tournament_id)
      .eq("status", "approved")
      .eq("withdrawn", false)) as { data: Array<{ id: string }> | null };
    if ((cnt?.length ?? 0) >= t.max_participants) {
      return { ok: false, error: "tournament_full" };
    }
  }

  const { data, error } = (await supabase
    .from("tournament_participants")
    .insert({
      tournament_id: v.tournament_id,
      player_id: v.player_id,
      seed: v.seed,
      status: "approved",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }
  revalidatePath(`/me/tournaments/organized/${v.tournament_id}`);
  return { ok: true, id: data.id };
}

/**
 * Approve / reject a pending application. Called from the participants UI on
 * the organizer's tournament page.
 */
export async function setParticipantStatus(
  tournamentId: string,
  participantId: string,
  status: "approved" | "rejected",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  // Confirm ownership + capacity (only for approval).
  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, name, status, format, starts_on, max_participants, match_rules")
    .eq("id", tournamentId)
    .single()) as {
    data: {
      id: string;
      owner_id: string;
      name: string;
      status: TournamentStatus;
      format: TournamentFormat;
      starts_on: string;
      max_participants: number | null;
      match_rules: MatchRules | null;
    } | null;
  };
  if (!t) return { ok: false, error: "tournament_not_found" };
  if (t.owner_id !== userId) return { ok: false, error: "not_owner" };

  const { data: p } = (await supabase
    .from("tournament_participants")
    .select("id, player_id, status, withdrawn")
    .eq("id", participantId)
    .eq("tournament_id", tournamentId)
    .single()) as {
    data: {
      id: string;
      player_id: string;
      status: ParticipantStatus;
      withdrawn: boolean;
    } | null;
  };
  if (!p) return { ok: false, error: "participant_not_found" };

  const { data: cnt } = (await supabase
    .from("tournament_participants")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .eq("withdrawn", false)) as { data: Array<{ id: string }> | null };
  const guard = canSetParticipantStatus({
    target: status,
    tournamentStatus: t.status,
    approvedCount: cnt?.length ?? 0,
    maxParticipants: t.max_participants,
  });
  if (!guard.ok) return guard;

  const { error } = await supabase
    .from("tournament_participants")
    .update({ status } as never)
    .eq("id", participantId);
  if (error) return { ok: false, error: error.message };

  // Best-effort email — don't fail the action if outbox is unhappy.
  try {
    const { data: profile } = (await supabase
      .from("profiles")
      .select("locale, notification_email")
      .eq("id", p.player_id)
      .single()) as { data: { locale: Locale; notification_email: boolean } | null };
    if (profile?.notification_email) {
      const service = createSupabaseServiceClient();
      const rulesText = (() => {
        const r = t.match_rules;
        if (!r) return "";
        switch (r.kind) {
          case "best_of_3":
            return `best of 3 sets to ${r.set_target}`;
          case "best_of_5":
            return `best of 5 sets to ${r.set_target}`;
          case "single_set":
            return `single set to ${r.set_target}`;
          case "pro_set":
            return `pro-set to ${r.target_games}`;
          case "first_to_games":
            return `first to ${r.target_games} games`;
          case "timed":
            return `${r.minutes}-minute match`;
          default:
            return "standard";
        }
      })();
      await enqueue(service, {
        recipient_id: p.player_id,
        channel: "email",
        template:
          status === "approved"
            ? "tournament_application_approved"
            : "tournament_application_rejected",
        locale: profile.locale,
        payload: {
          tournament_id: tournamentId,
          tournament_name: t.name,
          starts_at: t.starts_on,
          format: t.format,
          rules: rulesText,
        },
      });
    }
  } catch (e) {
    console.warn("[tournaments] failed to enqueue application decision email:", e);
  }

  revalidatePath(`/me/tournaments/organized/${tournamentId}`);
  revalidatePath("/me/tournaments");
  return { ok: true };
}

export async function removeParticipant(
  tournamentId: string,
  participantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, status")
    .eq("id", tournamentId)
    .single()) as {
    data: { id: string; owner_id: string; status: TournamentStatus } | null;
  };
  if (!t || t.owner_id !== userId) return { ok: false, error: "not_owner" };
  if (t.status === "in_progress" || t.status === "finished") {
    return { ok: false, error: "tournament_locked" };
  }

  const { error } = await supabase
    .from("tournament_participants")
    .delete()
    .eq("id", participantId)
    .eq("tournament_id", tournamentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/me/tournaments/organized/${tournamentId}`);
  return { ok: true };
}

// =============================================================================
// Bracket generation (single elimination + round-robin)
// =============================================================================

// Names + current Elo for a set of players via the RLS-exposed
// `public_player_basic` view. The raw `profiles` table is self-read-only, so
// joining it from participant queries would yield nulls for everyone except
// the caller (and Elo seeding would degrade to random).
async function loadPlayerBasics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  playerIds: string[],
): Promise<
  Map<
    string,
    { display_name: string | null; avatar_url: string | null; current_elo: number | null }
  >
> {
  const unique = Array.from(new Set(playerIds));
  if (unique.length === 0) return new Map();
  const { data } = (await supabase
    .from("public_player_basic")
    .select("id, display_name, avatar_url, current_elo")
    .in("id", unique)) as {
    data: Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      current_elo: number | null;
    }> | null;
  };
  return new Map(
    (data ?? []).map((b) => [
      b.id,
      {
        display_name: b.display_name,
        avatar_url: b.avatar_url,
        current_elo: b.current_elo,
      },
    ]),
  );
}

export async function generateBracket(
  tournamentId: string,
  opts: { method?: SeedingMethod; rngSeed?: number } = {},
): Promise<{ ok: true; matchesCount: number } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, format, status, draw_method, match_rules")
    .eq("id", tournamentId)
    .single()) as {
    data: {
      id: string;
      owner_id: string;
      format: TournamentFormat;
      status: TournamentStatus;
      draw_method: SeedingMethod | null;
      match_rules: MatchRules;
    } | null;
  };
  if (!t || t.owner_id !== userId) return { ok: false, error: "not_owner" };
  if (t.format !== "single_elimination" && t.format !== "round_robin") {
    // Hybrid (group_playoff) tournaments use generateGroups → closeGroupsAndStartPlayoff instead.
    return { ok: false, error: "format_not_supported_yet" };
  }
  if (t.status === "in_progress" || t.status === "finished") {
    return { ok: false, error: "already_started" };
  }

  // Wipe any previous matches (re-draw before start is allowed).
  await supabase.from("matches").delete().eq("tournament_id", tournamentId);

  // Only APPROVED, non-withdrawn players land in the bracket.
  // NOTE: no `profiles` join — `profiles_self_read` RLS would return null for
  // every participant except the caller, silently degrading rating-based
  // seeding to "everyone is 1000". Use the RLS-exposed projection instead
  // (same pattern as loadTournamentDetail).
  const { data: parts } = (await supabase
    .from("tournament_participants")
    .select("player_id, seed, withdrawn, status")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .eq("withdrawn", false)) as {
    data: Array<{
      player_id: string;
      seed: number | null;
      withdrawn: boolean;
      status: ParticipantStatus;
    }> | null;
  };

  const basicById = await loadPlayerBasics(
    supabase,
    (parts ?? []).map((p) => p.player_id),
  );
  const players: DrawPlayer[] = (parts ?? []).map((p) => {
    const b = basicById.get(p.player_id);
    return {
      id: p.player_id,
      display_name: b?.display_name ?? null,
      current_elo: b?.current_elo ?? 1000,
    };
  });
  if (players.length < 2) return { ok: false, error: "need_at_least_2_players" };

  const method: SeedingMethod = opts.method ?? t.draw_method ?? "rating";
  let orderedPlayers = players;
  if (method === "manual") {
    const seeded = (parts ?? [])
      .filter((p) => p.seed != null)
      .sort((a, b) => a.seed! - b.seed!)
      .map((p) => p.player_id);
    const unseeded = (parts ?? []).filter((p) => p.seed == null).map((p) => p.player_id);
    const ordering = [...seeded, ...unseeded];
    const byId = new Map(players.map((p) => [p.id, p] as const));
    orderedPlayers = ordering.map((id) => byId.get(id)!).filter(Boolean);
  }

  let rows: Array<{
    tournament_id: string;
    round: number;
    bracket_slot: number;
    p1_id: string | null;
    p2_id: string | null;
    outcome: "pending" | "walkover_p1";
    winner_side: "p1" | null;
    match_rules: MatchRules;
  }>;

  if (t.format === "round_robin") {
    const { matches } = buildRoundRobinSchedule(orderedPlayers);
    rows = matches.map((m) => ({
      tournament_id: tournamentId,
      round: m.round,
      bracket_slot: m.bracket_slot,
      p1_id: m.p1_id,
      p2_id: m.p2_id,
      outcome: "pending" as const,
      winner_side: null,
      match_rules: t.match_rules,
    }));
  } else {
    const { matches } = buildSingleEliminationBracket({
      players: orderedPlayers,
      method,
      rngSeed: opts.rngSeed ?? Date.now() % 1_000_000,
    });
    // Persist the FULL bracket skeleton (including matches whose sides are
    // still TBD — e.g. final waiting on semifinal winners). The `matches.p1_id`
    // column is nullable for exactly this reason; without these rows the UI
    // would only render round 1 and the final would silently disappear until
    // it bubbles up via propagation.
    rows = matches.map((m) => {
      const isAutoBye = m.round === 1 && (m.p1_id != null) !== (m.p2_id != null);
      // If round-1 had a bye, normalise so the present player sits in p1_id
      // and we can credit them an auto-win without a second row.
      const [p1, p2] =
        isAutoBye && m.p1_id == null && m.p2_id != null ? [m.p2_id, null] : [m.p1_id, m.p2_id];
      return {
        tournament_id: tournamentId,
        round: m.round,
        bracket_slot: m.bracket_slot,
        p1_id: p1,
        p2_id: p2,
        outcome: isAutoBye ? ("walkover_p1" as const) : ("pending" as const),
        winner_side: isAutoBye ? ("p1" as const) : null,
        match_rules: t.match_rules,
      };
    });
  }

  const { error: insertErr } = await supabase.from("matches").insert(rows as never);
  if (insertErr) return { ok: false, error: insertErr.message };

  await supabase
    .from("tournaments")
    .update({ status: "in_progress" } as never)
    .eq("id", tournamentId);

  revalidatePath(`/me/tournaments/organized/${tournamentId}`);
  return { ok: true, matchesCount: rows.length };
}

// =============================================================================
// Hybrid (group + playoff) flow
// =============================================================================

// Helpers shared by generate/close/move.
async function loadApprovedDrawPlayers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tournamentId: string,
): Promise<DrawPlayer[]> {
  // Same RLS caveat as in generateBracket: read Elo via public_player_basic,
  // never via a `profiles` join.
  const { data } = (await supabase
    .from("tournament_participants")
    .select("player_id")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .eq("withdrawn", false)) as {
    data: Array<{ player_id: string }> | null;
  };
  const ids = (data ?? []).map((p) => p.player_id);
  const basicById = await loadPlayerBasics(supabase, ids);
  return ids.map((id) => {
    const b = basicById.get(id);
    return {
      id,
      display_name: b?.display_name ?? null,
      current_elo: b?.current_elo ?? 1000,
    };
  });
}

function groupName(position: number): string {
  // 0 → A, 1 → B, …, 25 → Z, 26 → AA — supports up to 16 groups (≤ Z) plus margin.
  if (position < 26) return String.fromCharCode(65 + position);
  const tens = Math.floor(position / 26) - 1;
  const ones = position % 26;
  return String.fromCharCode(65 + tens) + String.fromCharCode(65 + ones);
}

/**
 * Generate the group stage for a hybrid (group_playoff) tournament. Wipes any
 * previously generated groups / matches and starts fresh.
 *
 * Allowed when:
 *   – format = group_playoff,
 *   – status ∈ {draft, registration} (we'll bump it to in_progress here),
 *   – ≥ 2 approved players per group requested.
 */
export async function generateGroups(
  input: unknown,
): Promise<{ ok: true; groupsCount: number; matchesCount: number } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = GenerateGroupsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, format, status, match_rules")
    .eq("id", v.tournament_id)
    .single()) as {
    data: {
      id: string;
      owner_id: string;
      format: TournamentFormat;
      status: TournamentStatus;
      match_rules: MatchRules;
    } | null;
  };
  if (!t || t.owner_id !== userId) return { ok: false, error: "not_owner" };
  if (t.format !== "group_playoff") return { ok: false, error: "format_not_group_playoff" };
  if (t.status === "finished") return { ok: false, error: "already_finished" };

  const players = await loadApprovedDrawPlayers(supabase, v.tournament_id);
  if (players.length < v.groups_count * 2) {
    return { ok: false, error: "need_at_least_2_players_per_group" };
  }

  // Wipe previous state (matches first, then groups; participants get their
  // group_id unset by the ON DELETE SET NULL FK).
  await supabase.from("matches").delete().eq("tournament_id", v.tournament_id);
  await supabase.from("tournament_groups").delete().eq("tournament_id", v.tournament_id);

  // Create fresh groups.
  const groupRows = Array.from({ length: v.groups_count }, (_, i) => ({
    tournament_id: v.tournament_id,
    name: groupName(i),
    position: i,
  }));
  const { data: insertedGroups, error: gErr } = (await supabase
    .from("tournament_groups")
    .insert(groupRows as never)
    .select("id, position")) as {
    data: Array<{ id: string; position: number }> | null;
    error: { message: string } | null;
  };
  if (gErr || !insertedGroups) {
    return { ok: false, error: gErr?.message ?? "groups_insert_failed" };
  }
  const groupIdByPosition = new Map(insertedGroups.map((g) => [g.position, g.id] as const));

  // Distribute players into buckets per the chosen method.
  const buckets = distributeIntoGroups({
    players,
    groupsCount: v.groups_count,
    method: v.method,
    rngSeed: v.rng_seed ?? Date.now() % 1_000_000,
  });

  // Assign group_id on tournament_participants.
  for (const b of buckets) {
    const gid = groupIdByPosition.get(b.position);
    if (!gid) continue;
    if (b.players.length === 0) continue;
    const ids = b.players.map((p) => p.id);
    const { error: upErr } = await supabase
      .from("tournament_participants")
      .update({ group_id: gid } as never)
      .eq("tournament_id", v.tournament_id)
      .in("player_id", ids);
    if (upErr) return { ok: false, error: upErr.message };
  }

  // Schedule round-robin matches inside each group.
  type MatchInsert = {
    tournament_id: string;
    round: number;
    bracket_slot: number;
    p1_id: string;
    p2_id: string | null;
    outcome: "pending";
    winner_side: null;
    match_rules: MatchRules;
    stage: "group";
    group_id: string;
  };
  const matchRows: MatchInsert[] = [];
  for (const b of buckets) {
    if (b.players.length < 2) continue;
    const gid = groupIdByPosition.get(b.position)!;
    const { matches } = buildRoundRobinSchedule(b.players);
    for (const m of matches) {
      matchRows.push({
        tournament_id: v.tournament_id,
        round: m.round,
        bracket_slot: m.bracket_slot,
        p1_id: m.p1_id,
        p2_id: m.p2_id,
        outcome: "pending",
        winner_side: null,
        match_rules: t.match_rules,
        stage: "group",
        group_id: gid,
      });
    }
  }
  if (matchRows.length > 0) {
    const { error: mErr } = await supabase.from("matches").insert(matchRows as never);
    if (mErr) return { ok: false, error: mErr.message };
  }

  await supabase
    .from("tournaments")
    .update({
      groups_count: v.groups_count,
      // Clear any stale playoff/advance settings from a previous run.
      advance_per_group: null,
      playoff_size: null,
      status: "in_progress",
    } as never)
    .eq("id", v.tournament_id);

  revalidatePath(`/me/tournaments/organized/${v.tournament_id}`);
  return { ok: true, groupsCount: v.groups_count, matchesCount: matchRows.length };
}

/**
 * Drag-and-drop a participant into a different group. Allowed only before any
 * group match has a result — once standings start forming the bracket history
 * would diverge.
 */
export async function reassignToGroup(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = MoveToGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;

  const { data: p } = (await supabase
    .from("tournament_participants")
    .select(
      "id, tournament_id, group_id, status, withdrawn, " +
        "tournaments!inner(id, owner_id, format)",
    )
    .eq("id", v.participant_id)
    .single()) as {
    data: {
      id: string;
      tournament_id: string;
      group_id: string | null;
      status: ParticipantStatus;
      withdrawn: boolean;
      tournaments: { id: string; owner_id: string; format: TournamentFormat } | null;
    } | null;
  };
  if (!p || !p.tournaments) return { ok: false, error: "participant_not_found" };
  if (p.tournaments.owner_id !== userId) return { ok: false, error: "not_owner" };
  if (p.tournaments.format !== "group_playoff")
    return { ok: false, error: "format_not_group_playoff" };
  if (p.status !== "approved" || p.withdrawn)
    return { ok: false, error: "participant_not_approved" };

  // Confirm the target group belongs to the same tournament.
  const { data: targetGroup } = (await supabase
    .from("tournament_groups")
    .select("id, tournament_id")
    .eq("id", v.group_id)
    .single()) as { data: { id: string; tournament_id: string } | null };
  if (!targetGroup || targetGroup.tournament_id !== p.tournament_id) {
    return { ok: false, error: "group_not_in_tournament" };
  }
  if (targetGroup.id === p.group_id) return { ok: true };

  // Block reassignment if any group match already has a result.
  const { data: playedRows } = (await supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", p.tournament_id)
    .eq("stage", "group")
    .neq("outcome", "pending")
    .limit(1)) as { data: Array<{ id: string }> | null };
  if ((playedRows?.length ?? 0) > 0) {
    return { ok: false, error: "group_matches_already_started" };
  }

  // Move the participant. The current player's old RR matches need to be
  // dropped (they were scheduled against the wrong group's roster); we'll
  // regenerate the affected groups' schedules below.
  const oldGroupId = p.group_id;
  await supabase
    .from("matches")
    .delete()
    .eq("tournament_id", p.tournament_id)
    .eq("stage", "group")
    .in("group_id", [oldGroupId, v.group_id].filter(Boolean) as string[]);

  const { error: upErr } = await supabase
    .from("tournament_participants")
    .update({ group_id: v.group_id } as never)
    .eq("id", v.participant_id);
  if (upErr) return { ok: false, error: upErr.message };

  // Re-schedule RR for both affected groups (old + new).
  const affected = [oldGroupId, v.group_id].filter((g): g is string => Boolean(g));
  for (const gid of affected) {
    const { data: members } = (await supabase
      .from("tournament_participants")
      .select("player_id")
      .eq("tournament_id", p.tournament_id)
      .eq("group_id", gid)
      .eq("status", "approved")
      .eq("withdrawn", false)) as {
      data: Array<{ player_id: string }> | null;
    };
    const memberIds = (members ?? []).map((m) => m.player_id);
    const memberBasics = await loadPlayerBasics(supabase, memberIds);
    const roster: DrawPlayer[] = memberIds.map((id) => {
      const b = memberBasics.get(id);
      return {
        id,
        display_name: b?.display_name ?? null,
        current_elo: b?.current_elo ?? 1000,
      };
    });
    if (roster.length < 2) continue;

    const { data: tt } = (await supabase
      .from("tournaments")
      .select("match_rules")
      .eq("id", p.tournament_id)
      .single()) as { data: { match_rules: MatchRules } | null };
    if (!tt) continue;

    const { matches } = buildRoundRobinSchedule(roster);
    const rows = matches.map((m) => ({
      tournament_id: p.tournament_id,
      round: m.round,
      bracket_slot: m.bracket_slot,
      p1_id: m.p1_id,
      p2_id: m.p2_id,
      outcome: "pending" as const,
      winner_side: null,
      match_rules: tt.match_rules,
      stage: "group" as const,
      group_id: gid,
    }));
    await supabase.from("matches").insert(rows as never);
  }

  revalidatePath(`/me/tournaments/organized/${p.tournament_id}`);
  return { ok: true };
}

/**
 * Close the group stage and generate the playoff bracket. Top-N players from
 * every group qualify (N = advance_per_group). The playoff is a standard
 * single-elimination bracket built via `buildSingleEliminationBracket` with
 * method="manual" so cross-bracket seeding is preserved (A1 vs B2, B1 vs A2,
 * etc). When `third_place_match` is on, an extra match is inserted to be
 * filled by the two losing semi-finalists.
 */
export async function closeGroupsAndStartPlayoff(
  input: unknown,
): Promise<
  { ok: true; playoffMatches: number; thirdPlaceMatch: boolean } | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = CloseGroupsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const v = parsed.data;

  const { data: t } = (await supabase
    .from("tournaments")
    .select("id, owner_id, format, status, match_rules, groups_count, third_place_match")
    .eq("id", v.tournament_id)
    .single()) as {
    data: {
      id: string;
      owner_id: string;
      format: TournamentFormat;
      status: TournamentStatus;
      match_rules: MatchRules;
      groups_count: number | null;
      third_place_match: boolean;
    } | null;
  };
  if (!t || t.owner_id !== userId) return { ok: false, error: "not_owner" };
  if (t.format !== "group_playoff") return { ok: false, error: "format_not_group_playoff" };
  if (t.groups_count == null) return { ok: false, error: "groups_not_generated" };

  const qualifiersTotal = t.groups_count * v.advance_per_group;
  if (qualifiersTotal > v.playoff_size) {
    return { ok: false, error: "playoff_size_too_small" };
  }

  // Bail out if any group match is still pending.
  const { data: pending } = (await supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", v.tournament_id)
    .eq("stage", "group")
    .eq("outcome", "pending")
    .limit(1)) as { data: Array<{ id: string }> | null };
  if ((pending?.length ?? 0) > 0) {
    return { ok: false, error: "group_matches_pending" };
  }

  // Compute per-group standings → take top-N.
  const { data: groups } = (await supabase
    .from("tournament_groups")
    .select("id, position")
    .eq("tournament_id", v.tournament_id)
    .order("position", { ascending: true })) as {
    data: Array<{ id: string; position: number }> | null;
  };

  // Pre-load every approved player's profile once for the bracket display.
  const allPlayers = await loadApprovedDrawPlayers(supabase, v.tournament_id);
  const playerById = new Map(allPlayers.map((p) => [p.id, p] as const));

  const qualifiers: GroupQualifier[] = [];
  for (const g of groups ?? []) {
    const { data: members } = (await supabase
      .from("tournament_participants")
      .select("player_id")
      .eq("tournament_id", v.tournament_id)
      .eq("group_id", g.id)
      .eq("status", "approved")
      .eq("withdrawn", false)) as { data: Array<{ player_id: string }> | null };
    const ids = (members ?? []).map((m) => m.player_id);

    const { data: groupMatches } = (await supabase
      .from("matches")
      .select("p1_id, p2_id, winner_side, outcome, sets")
      .eq("tournament_id", v.tournament_id)
      .eq("group_id", g.id)) as {
      data: Array<{
        p1_id: string;
        p2_id: string | null;
        winner_side: "p1" | "p2" | null;
        outcome: string;
        sets: Array<{ p1: number; p2: number }> | null;
      }> | null;
    };

    const standings = computeRoundRobinStandings(
      ids,
      (groupMatches ?? [])
        .filter((m) => m.p2_id != null)
        .map((m) => ({
          p1_id: m.p1_id,
          p2_id: m.p2_id as string,
          winner_side: m.winner_side,
          outcome: m.outcome,
          sets: m.sets,
        })),
    );
    standings.slice(0, v.advance_per_group).forEach((row) => {
      const player = playerById.get(row.player_id);
      if (!player) return;
      qualifiers.push({
        group_position: g.position,
        rank: row.position,
        player,
      });
    });
  }

  if (qualifiers.length < 2) {
    return { ok: false, error: "not_enough_qualifiers" };
  }

  // Wipe any previous playoff/third-place matches (e.g. from a re-close).
  await supabase
    .from("matches")
    .delete()
    .eq("tournament_id", v.tournament_id)
    .in("stage", ["playoff", "third_place"]);

  // Cross-bracket seeding via buildSingleEliminationBracket(method=manual).
  const orderedPlayers = orderQualifiersForPlayoff(qualifiers);
  const { matches, totalRounds } = buildSingleEliminationBracket({
    players: orderedPlayers,
    method: "manual",
  });

  // Persist the FULL playoff skeleton, including round 2+ rows where both
  // sides are still TBD. Without these rows the bracket UI would only render
  // round 1 (semifinals) and the final would silently disappear until the
  // propagation in `setMatchScore` created it — which it didn't, because
  // `matches.p1_id` used to be NOT NULL.
  const baseRows = matches.map((m) => {
    const isAutoBye = m.round === 1 && (m.p1_id != null) !== (m.p2_id != null);
    // Round-1 bye normalisation: present player to p1_id, auto-credit them.
    const [p1, p2] =
      isAutoBye && m.p1_id == null && m.p2_id != null ? [m.p2_id, null] : [m.p1_id, m.p2_id];
    return {
      tournament_id: v.tournament_id,
      round: m.round,
      bracket_slot: m.bracket_slot,
      p1_id: p1,
      p2_id: p2,
      outcome: isAutoBye ? "walkover_p1" : "pending",
      winner_side: isAutoBye ? "p1" : null,
      match_rules: t.match_rules,
      stage: "playoff" as const,
      group_id: null as string | null,
    };
  });

  const { error: insertErr } = await supabase.from("matches").insert(baseRows as never);
  if (insertErr) return { ok: false, error: insertErr.message };

  // Insert a 3rd-place match if requested AND the bracket has semis to feed it.
  let thirdPlaceInserted = false;
  if (t.third_place_match && totalRounds >= 2) {
    const semiRound = totalRounds - 1;
    const { error: tpErr } = await supabase.from("matches").insert({
      tournament_id: v.tournament_id,
      round: semiRound, // visual placement next to the SFs; filled when both end
      bracket_slot: 99, // sentinel slot — clearly outside the main tree
      p1_id: null,
      p2_id: null,
      outcome: "pending",
      winner_side: null,
      match_rules: t.match_rules,
      stage: "third_place",
      group_id: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (tpErr) return { ok: false, error: tpErr.message };
    thirdPlaceInserted = true;
  }

  await supabase
    .from("tournaments")
    .update({
      advance_per_group: v.advance_per_group,
      playoff_size: v.playoff_size,
    } as never)
    .eq("id", v.tournament_id);

  revalidatePath(`/me/tournaments/organized/${v.tournament_id}`);
  return {
    ok: true,
    playoffMatches: baseRows.length,
    thirdPlaceMatch: thirdPlaceInserted,
  };
}

// =============================================================================
// Score entry → updates match + propagates winner into the next round.
// =============================================================================

export async function setMatchScore(
  input: unknown,
): Promise<
  { ok: true; eloP1Delta: number | null; eloP2Delta: number | null } | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = ScoreFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;

  const { data: m } = (await supabase
    .from("matches")
    .select(
      "id, tournament_id, round, bracket_slot, p1_id, p2_id, stage, group_id, match_rules, " +
        "tournaments(owner_id, format)",
    )
    .eq("id", v.match_id)
    .single()) as {
    data: {
      id: string;
      tournament_id: string | null;
      round: number | null;
      bracket_slot: number | null;
      p1_id: string | null;
      p2_id: string | null;
      stage: MatchStage | null;
      group_id: string | null;
      match_rules: MatchRules | null;
      tournaments: { owner_id: string; format: TournamentFormat } | null;
    } | null;
  };
  if (!m) return { ok: false, error: "match_not_found" };
  if (!m.tournaments || m.tournaments.owner_id !== userId) {
    return { ok: false, error: "not_owner" };
  }
  if (!m.tournament_id || m.round == null || m.bracket_slot == null) {
    return { ok: false, error: "not_a_bracket_match" };
  }
  if (m.p1_id == null || m.p2_id == null) {
    // Bracket placeholder waiting on a previous round — can't score yet.
    return { ok: false, error: "match_not_ready" };
  }
  const isRoundRobin = m.tournaments.format === "round_robin" || m.stage === "group";

  // Drop trailing untouched "0:0" placeholder sets from the score widget,
  // then validate the rest against the tournament's match rules. Special
  // outcomes (walkover / retired / DSQ) skip validation — their score is
  // whatever was played before the stoppage.
  const sets = [...v.sets];
  while (sets.length > 0) {
    const last = sets[sets.length - 1];
    if (last.p1 === 0 && last.p2 === 0 && last.tb_p1 == null && last.tb_p2 == null) {
      sets.pop();
    } else {
      break;
    }
  }
  if (v.outcome === "completed" && m.match_rules) {
    const validation = validateScoreAgainstRules(sets, m.match_rules);
    if (!validation.ok) return { ok: false, error: validation.error };
  }

  const winner = computeWinnerSide({
    outcome: v.outcome,
    sets: sets.map((s) => ({ p1: s.p1, p2: s.p2 })),
  });
  if (v.outcome === "completed" && winner == null) {
    return { ok: false, error: "tied_score" };
  }

  const { error: upErr } = await supabase
    .from("matches")
    .update({
      outcome: v.outcome,
      sets,
      winner_side: winner,
      played_at: new Date().toISOString(),
    } as never)
    .eq("id", v.match_id);
  if (upErr) return { ok: false, error: upErr.message };

  let eloP1Delta: number | null = null;
  let eloP2Delta: number | null = null;
  const recalc = await recalcMatchElo(supabase, v.match_id);
  if (recalc.ok && !recalc.skipped) {
    eloP1Delta = recalc.p1Delta;
    eloP2Delta = recalc.p2Delta;
  }

  // Per-club rating: a club tournament's matches feed that club's ladder.
  // Service role (club rating tables deny non-admin writes); idempotent.
  await recalcClubRatingsForMatch(createSupabaseServiceClient(), v.match_id);

  // ── ROUND-ROBIN (pure RR tournaments and group-stage matches inside a hybrid)
  if (isRoundRobin) {
    // For a hybrid we only consider GROUP-stage matches; the playoff continues
    // even after every group match is in.
    const baseQuery = supabase
      .from("matches")
      .select("id", { count: "exact" })
      .eq("tournament_id", m.tournament_id)
      .eq("outcome", "pending");
    const { data: remaining } = (await (
      m.tournaments.format === "round_robin" ? baseQuery : baseQuery.eq("stage", "group")
    ).limit(1)) as { data: Array<{ id: string }> | null };

    if (!remaining || remaining.length === 0) {
      if (m.tournaments.format === "round_robin") {
        await supabase
          .from("tournaments")
          .update({ status: "finished" } as never)
          .eq("id", m.tournament_id);
      }
      // Hybrid: don't auto-finish — organiser still has to call
      // closeGroupsAndStartPlayoff() to seed the playoff.
    }

    revalidatePath(`/me/tournaments/organized/${m.tournament_id}`);
    return { ok: true, eloP1Delta, eloP2Delta };
  }

  // ── SINGLE-ELIMINATION (pure SE tournaments and playoff stage of a hybrid)
  // Either the legacy round-based propagation (stage = null) or the playoff
  // tree of a hybrid (stage = 'playoff'). Third-place matches don't propagate
  // anywhere — they're a leaf — so we skip propagation for stage='third_place'.
  if (m.stage !== "third_place") {
    const winnerId = winner === "p1" ? m.p1_id : m.p2_id;
    if (winnerId) {
      const nextRound = m.round + 1;
      const nextSlot = Math.ceil(m.bracket_slot / 2);
      const side: "p1_id" | "p2_id" = m.bracket_slot % 2 === 1 ? "p1_id" : "p2_id";

      // Look up the next match within the same tree (same stage). For legacy
      // tournaments stage is null on both sides, so we don't constrain by it.
      const nextQ = supabase
        .from("matches")
        .select("id, p1_id, p2_id")
        .eq("tournament_id", m.tournament_id)
        .eq("round", nextRound)
        .eq("bracket_slot", nextSlot);
      const { data: nextMatch } = (await (
        m.stage ? nextQ.eq("stage", m.stage) : nextQ.is("stage", null)
      ).maybeSingle()) as {
        data: { id: string; p1_id: string | null; p2_id: string | null } | null;
      };

      if (nextMatch) {
        await supabase
          .from("matches")
          .update({ [side]: winnerId } as never)
          .eq("id", nextMatch.id);
      }
    }

    // If this was a semifinal of a hybrid playoff AND a third-place slot
    // exists, drop the LOSER into it (first arriving → p1, second → p2).
    if (m.stage === "playoff" && winner) {
      const { data: tInfo } = (await supabase
        .from("matches")
        .select("round")
        .eq("tournament_id", m.tournament_id)
        .eq("stage", "playoff")
        .order("round", { ascending: false })
        .limit(1)
        .maybeSingle()) as { data: { round: number } | null };
      const finalRound = tInfo?.round ?? null;

      if (finalRound != null && m.round === finalRound - 1) {
        const loserId = winner === "p1" ? m.p2_id : m.p1_id;
        if (loserId) {
          const { data: tp } = (await supabase
            .from("matches")
            .select("id, p1_id, p2_id")
            .eq("tournament_id", m.tournament_id)
            .eq("stage", "third_place")
            .maybeSingle()) as {
            data: { id: string; p1_id: string | null; p2_id: string | null } | null;
          };
          if (tp) {
            const patch = tp.p1_id == null ? { p1_id: loserId } : { p2_id: loserId };
            await supabase
              .from("matches")
              .update(patch as never)
              .eq("id", tp.id);
          }
        }
      }
    }
  }

  // Finish detection — single-elim and hybrid playoff alike: the tournament
  // is finished when the playoff final has a winner AND, if applicable, the
  // 3rd-place match has a winner too.
  const stageScope = m.stage ?? null;
  const finalQ = supabase
    .from("matches")
    .select("round, winner_side")
    .eq("tournament_id", m.tournament_id);
  const { data: finalMatch } = (await (
    stageScope ? finalQ.eq("stage", "playoff") : finalQ.is("stage", null)
  )
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { round: number; winner_side: string | null } | null };

  if (finalMatch?.winner_side) {
    // For hybrids with a 3rd-place match, wait for it to resolve too.
    let canFinish = true;
    if (m.stage) {
      const { data: tp } = (await supabase
        .from("matches")
        .select("winner_side")
        .eq("tournament_id", m.tournament_id)
        .eq("stage", "third_place")
        .maybeSingle()) as { data: { winner_side: string | null } | null };
      if (tp && !tp.winner_side) canFinish = false;
    }
    if (canFinish) {
      await supabase
        .from("tournaments")
        .update({ status: "finished" } as never)
        .eq("id", m.tournament_id);
    }
  }

  revalidatePath(`/me/tournaments/organized/${m.tournament_id}`);
  return { ok: true, eloP1Delta, eloP2Delta };
}

// =============================================================================
// Round-robin standings, used by both organizer and player tournament pages.
// =============================================================================

export type StandingsLine = StandingRow & {
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number;
};

export type GroupStandingsBlock = {
  group: GroupRow;
  rows: StandingsLine[];
};

export async function loadGroupStandings(tournamentId: string): Promise<GroupStandingsBlock[]> {
  const supabase = await createSupabaseServerClient();

  const { data: groups } = (await supabase
    .from("tournament_groups")
    .select("id, name, position")
    .eq("tournament_id", tournamentId)
    .order("position", { ascending: true })) as { data: Array<GroupRow> | null };
  if (!groups || groups.length === 0) return [];

  // RLS: read names/Elo via public_player_basic, not a `profiles` join.
  const { data: members } = (await supabase
    .from("tournament_participants")
    .select("player_id, group_id, status, withdrawn")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .eq("withdrawn", false)) as {
    data: Array<{
      player_id: string;
      group_id: string | null;
    }> | null;
  };

  const { data: matches } = (await supabase
    .from("matches")
    .select("group_id, p1_id, p2_id, winner_side, outcome, sets")
    .eq("tournament_id", tournamentId)
    .eq("stage", "group")) as {
    data: Array<{
      group_id: string | null;
      p1_id: string | null;
      p2_id: string | null;
      winner_side: "p1" | "p2" | null;
      outcome: string;
      sets: Array<{ p1: number; p2: number }> | null;
    }> | null;
  };

  const profileById = await loadPlayerBasics(
    supabase,
    (members ?? []).map((m) => m.player_id),
  );

  return groups.map((g) => {
    const groupPlayerIds = (members ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => m.player_id);
    const groupMatches = (matches ?? [])
      .filter((m) => m.group_id === g.id && m.p1_id != null && m.p2_id != null)
      .map((m) => ({
        p1_id: m.p1_id as string,
        p2_id: m.p2_id as string,
        winner_side: m.winner_side,
        outcome: m.outcome,
        sets: m.sets,
      }));
    const standings = computeRoundRobinStandings(groupPlayerIds, groupMatches);
    return {
      group: g,
      rows: standings.map((s) => {
        const prof = profileById.get(s.player_id);
        return {
          ...s,
          display_name: prof?.display_name ?? null,
          avatar_url: prof?.avatar_url ?? null,
          current_elo: prof?.current_elo ?? 1000,
        };
      }),
    };
  });
}

export async function loadRoundRobinStandings(tournamentId: string): Promise<StandingsLine[]> {
  const supabase = await createSupabaseServerClient();

  // RLS: read names/Elo via public_player_basic, not a `profiles` join.
  const { data: parts } = (await supabase
    .from("tournament_participants")
    .select("player_id, status, withdrawn")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .eq("withdrawn", false)) as {
    data: Array<{
      player_id: string;
      status: ParticipantStatus;
      withdrawn: boolean;
    }> | null;
  };

  const playerIds = (parts ?? []).map((p) => p.player_id);
  if (playerIds.length === 0) return [];

  const { data: matches } = (await supabase
    .from("matches")
    .select("p1_id, p2_id, winner_side, outcome, sets")
    .eq("tournament_id", tournamentId)) as {
    data: Array<{
      p1_id: string | null;
      p2_id: string | null;
      winner_side: "p1" | "p2" | null;
      outcome: string;
      sets: Array<{ p1: number; p2: number }> | null;
    }> | null;
  };

  const standings = computeRoundRobinStandings(
    playerIds,
    (matches ?? [])
      .filter((m) => m.p1_id != null && m.p2_id != null)
      .map((m) => ({
        p1_id: m.p1_id as string,
        p2_id: m.p2_id as string,
        winner_side: m.winner_side,
        outcome: m.outcome,
        sets: m.sets,
      })),
  );

  const profileById = await loadPlayerBasics(supabase, playerIds);

  return standings.map((s) => {
    const prof = profileById.get(s.player_id);
    return {
      ...s,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      current_elo: prof?.current_elo ?? 1000,
    };
  });
}
