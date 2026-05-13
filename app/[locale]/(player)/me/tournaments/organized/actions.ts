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
  type TournamentFormat,
  type TournamentStatus,
  type SeedingMethod,
  type Privacy,
  type Surface,
  type MatchRules,
} from "@/lib/tournaments/schema";
import {
  buildRoundRobinSchedule,
  buildSingleEliminationBracket,
  computeRoundRobinStandings,
  computeWinnerSide,
  type Player as DrawPlayer,
  type StandingRow,
} from "@/lib/tournaments/draw";
import { recalcMatchElo } from "@/lib/rating/recalc";

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
  status: TournamentStatus;
  draw_method: SeedingMethod | null;
  prizes_description: string | null;
  match_rules: MatchRules;
  participants_count: number;
  pending_count: number;
  venues: TournamentVenueRef[];
  created_at: string;
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
        "registration_deadline, max_participants, entry_fee_byn, privacy, status, " +
        "draw_method, prizes_description, match_rules, created_at",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })) as {
    data: Array<
      Omit<TournamentRow, "participants_count" | "pending_count" | "venues">
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

export async function loadTournamentDetail(tournamentId: string): Promise<
  | {
      ok: true;
      tournament: TournamentRow;
      participants: ParticipantRow[];
      matches: MatchRow[];
      playerOptions: PlayerOption[];
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
        "ends_on, registration_deadline, max_participants, entry_fee_byn, privacy, status, " +
        "draw_method, prizes_description, match_rules, created_at",
    )
    .eq("id", tournamentId)
    .single()) as {
    data:
      | (Omit<TournamentRow, "participants_count" | "pending_count" | "venues"> & {
          owner_id: string;
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
    .select("id, player_id, seed, status, withdrawn, registered_at")
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
    }> | null;
  };

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
      display_name: b?.display_name ?? null,
      avatar_url: b?.avatar_url ?? null,
      current_elo: b?.current_elo ?? 1000,
    };
  });

  const { data: ms } = (await supabase
    .from("matches")
    .select(
      "id, round, bracket_slot, p1_id, p2_id, winner_side, outcome, sets, scheduled_at, played_at",
    )
    .eq("tournament_id", tournamentId)
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
      status: t.status,
      draw_method: t.draw_method,
      prizes_description: t.prizes_description,
      match_rules: t.match_rules,
      participants_count,
      pending_count,
      venues,
      created_at: t.created_at,
    },
    participants,
    matches,
    playerOptions,
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

export async function createTournament(input: unknown): Promise<SaveResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = TournamentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;

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
      draw_method: v.draw_method,
      prizes_description: v.prizes_description,
      match_rules: v.match_rules,
      status: "draft",
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

export async function updateTournament(id: string, input: unknown): Promise<SaveResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = TournamentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;

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
      draw_method: v.draw_method,
      prizes_description: v.prizes_description,
      match_rules: v.match_rules,
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

export async function setTournamentStatus(
  id: string,
  status: TournamentStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { error } = await supabase
    .from("tournaments")
    .update({ status } as never)
    .eq("id", id)
    .eq("owner_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/me/tournaments/organized/${id}`);
  revalidatePath("/me/tournaments/organized");
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

  const { error } = await supabase
    .from("tournaments")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);
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
  if (t.status === "finished" || t.status === "cancelled") {
    return { ok: false, error: "tournament_locked" };
  }

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

  if (status === "approved" && t.max_participants != null) {
    const { data: cnt } = (await supabase
      .from("tournament_participants")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("status", "approved")
      .eq("withdrawn", false)) as { data: Array<{ id: string }> | null };
    if ((cnt?.length ?? 0) >= t.max_participants) {
      return { ok: false, error: "tournament_full" };
    }
  }

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
    return { ok: false, error: "format_not_supported_yet" };
  }
  if (t.status === "in_progress" || t.status === "finished") {
    return { ok: false, error: "already_started" };
  }

  // Wipe any previous matches (re-draw before start is allowed).
  await supabase.from("matches").delete().eq("tournament_id", tournamentId);

  // Only APPROVED, non-withdrawn players land in the bracket.
  const { data: parts } = (await supabase
    .from("tournament_participants")
    .select(
      "player_id, seed, withdrawn, status, " +
        "profiles!tournament_participants_player_id_fkey(display_name, current_elo)",
    )
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .eq("withdrawn", false)) as {
    data: Array<{
      player_id: string;
      seed: number | null;
      withdrawn: boolean;
      status: ParticipantStatus;
      profiles: { display_name: string | null; current_elo: number } | null;
    }> | null;
  };

  const players: DrawPlayer[] = (parts ?? []).map((p) => ({
    id: p.player_id,
    display_name: p.profiles?.display_name ?? null,
    current_elo: p.profiles?.current_elo ?? 1000,
  }));
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
    p1_id: string;
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
    rows = matches
      .filter((m) => m.p1_id || m.p2_id)
      .map((m) => {
        const [p1, p2] = m.p1_id == null && m.p2_id != null ? [m.p2_id, null] : [m.p1_id, m.p2_id];
        const isAutoBye = m.round === 1 && (m.p1_id == null || m.p2_id == null);
        return {
          tournament_id: tournamentId,
          round: m.round,
          bracket_slot: m.bracket_slot,
          p1_id: p1!,
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
      "id, tournament_id, round, bracket_slot, p1_id, p2_id, " +
        "tournaments(owner_id, format)",
    )
    .eq("id", v.match_id)
    .single()) as {
    data: {
      id: string;
      tournament_id: string | null;
      round: number | null;
      bracket_slot: number | null;
      p1_id: string;
      p2_id: string | null;
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
  const isRoundRobin = m.tournaments.format === "round_robin";

  const winner = computeWinnerSide({
    outcome: v.outcome,
    sets: v.sets.map((s) => ({ p1: s.p1, p2: s.p2 })),
  });
  if (v.outcome === "completed" && winner == null) {
    return { ok: false, error: "tied_score" };
  }

  const { error: upErr } = await supabase
    .from("matches")
    .update({
      outcome: v.outcome,
      sets: v.sets,
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

  if (isRoundRobin) {
    const { data: remaining } = (await supabase
      .from("matches")
      .select("id", { count: "exact" })
      .eq("tournament_id", m.tournament_id)
      .eq("outcome", "pending")
      .limit(1)) as { data: Array<{ id: string }> | null };
    if (!remaining || remaining.length === 0) {
      await supabase
        .from("tournaments")
        .update({ status: "finished" } as never)
        .eq("id", m.tournament_id);
    }
  } else {
    const winnerId = winner === "p1" ? m.p1_id : m.p2_id;
    if (winnerId) {
      const nextRound = m.round + 1;
      const nextSlot = Math.ceil(m.bracket_slot / 2);
      const side: "p1_id" | "p2_id" = m.bracket_slot % 2 === 1 ? "p1_id" : "p2_id";

      const { data: nextMatch } = (await supabase
        .from("matches")
        .select("id, p1_id, p2_id")
        .eq("tournament_id", m.tournament_id)
        .eq("round", nextRound)
        .eq("bracket_slot", nextSlot)
        .maybeSingle()) as {
        data: { id: string; p1_id: string | null; p2_id: string | null } | null;
      };

      if (nextMatch) {
        await supabase
          .from("matches")
          .update({ [side]: winnerId } as never)
          .eq("id", nextMatch.id);
      }
    }

    const { data: finalMatch } = (await supabase
      .from("matches")
      .select("round, winner_side")
      .eq("tournament_id", m.tournament_id)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle()) as {
      data: { round: number; winner_side: string | null } | null;
    };
    if (finalMatch?.winner_side) {
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

export async function loadRoundRobinStandings(tournamentId: string): Promise<StandingsLine[]> {
  const supabase = await createSupabaseServerClient();

  const { data: parts } = (await supabase
    .from("tournament_participants")
    .select(
      "player_id, status, withdrawn, " +
        "profiles!tournament_participants_player_id_fkey(display_name, avatar_url, current_elo)",
    )
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .eq("withdrawn", false)) as {
    data: Array<{
      player_id: string;
      status: ParticipantStatus;
      withdrawn: boolean;
      profiles: {
        display_name: string | null;
        avatar_url: string | null;
        current_elo: number;
      } | null;
    }> | null;
  };

  const playerIds = (parts ?? []).map((p) => p.player_id);
  if (playerIds.length === 0) return [];

  const { data: matches } = (await supabase
    .from("matches")
    .select("p1_id, p2_id, winner_side, outcome, sets")
    .eq("tournament_id", tournamentId)) as {
    data: Array<{
      p1_id: string;
      p2_id: string | null;
      winner_side: "p1" | "p2" | null;
      outcome: string;
      sets: Array<{ p1: number; p2: number }> | null;
    }> | null;
  };

  const standings = computeRoundRobinStandings(
    playerIds,
    (matches ?? [])
      .filter((m) => m.p2_id != null)
      .map((m) => ({
        p1_id: m.p1_id,
        p2_id: m.p2_id as string,
        winner_side: m.winner_side,
        outcome: m.outcome,
        sets: m.sets,
      })),
  );

  const profileById = new Map((parts ?? []).map((p) => [p.player_id, p.profiles] as const));

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
