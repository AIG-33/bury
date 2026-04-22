"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { recalcMatchElo } from "@/lib/rating/recalc";
import { inferWinnerFromSets as inferWinner } from "@/lib/matches/score";

// =============================================================================
// Friendly matches — "report → confirm" flow with two-party verification.
//
// Lifecycle for a friendly match:
//
//   proposed   → recipient accepts (existing /me/find/proposals flow)
//      ↓
//   scheduled  → players play, then ONE side reports the score
//      ↓
//   scheduled + sets filled + confirmed_by_<reporter>=true
//                            (this is the "awaiting confirmation" state;
//                             other side sees it in their inbox)
//      ↓
//   completed  → other side confirms → Elo is recalculated once.
//
// Or the match can be created in one step via the "quick register" form
// (already played, just want to log the score and Elo). That bypasses the
// proposed/scheduled handshake but still requires the opponent to confirm.
//
// Disputes:
//   – If the opponent disagrees, they can clear the score back to scheduled
//     so the reporter can enter it again. We never silently overwrite.
// =============================================================================

const SetSchema = z.object({
  p1_games: z.coerce.number().int().min(0).max(20),
  p2_games: z.coerce.number().int().min(0).max(20),
  tiebreak_p1: z.coerce.number().int().min(0).max(50).optional().nullable(),
  tiebreak_p2: z.coerce.number().int().min(0).max(50).optional().nullable(),
});

const SetsSchema = z.array(SetSchema).min(1).max(5);

function inferWinnerFromSets(
  sets: z.infer<typeof SetsSchema>,
): "p1" | "p2" | null {
  return inferWinner(sets);
}

// =============================================================================
// Quick register: an already-played match. Creates the match in `scheduled`
// state with sets pre-filled and the reporter pre-confirmed. The opponent
// must confirm (or dispute) before any Elo movement happens.
// =============================================================================

const QuickRegisterSchema = z.object({
  opponent_id: z.string().uuid(),
  played_at: z.string().datetime().optional().nullable(),
  sets: SetsSchema,
  notes: z.string().trim().max(300).optional().nullable(),
});

export type QuickRegisterResult =
  | { ok: true; match_id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_payload"
        | "self_match"
        | "winner_unknown"
        | "opponent_not_found"
        | "db_error";
      message?: string;
    };

export async function quickRegisterMatch(
  input: unknown,
): Promise<QuickRegisterResult> {
  const parsed = QuickRegisterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (parsed.data.opponent_id === user.id) return { ok: false, error: "self_match" };

  const winner = inferWinnerFromSets(parsed.data.sets);
  if (!winner) return { ok: false, error: "winner_unknown" };

  const { data: opp } = (await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.opponent_id)
    .maybeSingle()) as { data: { id: string } | null };
  if (!opp) return { ok: false, error: "opponent_not_found" };

  const service = createSupabaseServiceClient();
  const { data: inserted, error } = (await service
    .from("matches")
    .insert({
      p1_id: user.id,
      p2_id: parsed.data.opponent_id,
      is_doubles: false,
      outcome: "scheduled",
      sets: parsed.data.sets,
      winner_side: winner,
      played_at: parsed.data.played_at ?? new Date().toISOString(),
      // Reporter is auto-confirmed; opponent must still confirm.
      confirmed_by_p1: true,
      confirmed_by_p2: false,
      notes: parsed.data.notes ?? null,
    } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !inserted)
    return { ok: false, error: "db_error", message: error?.message };

  revalidatePath("/me/matches");
  revalidatePath("/me/rating");
  return { ok: true, match_id: inserted.id };
}

// =============================================================================
// Report a result for an already-scheduled friendly match. The reporter sets
// the sets/winner and pre-confirms; opponent then confirms.
// =============================================================================

const ReportSchema = z.object({
  match_id: z.string().uuid(),
  sets: SetsSchema,
});

export type ReportResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_payload"
        | "match_not_found"
        | "not_authorized"
        | "wrong_state"
        | "winner_unknown"
        | "db_error";
      message?: string;
    };

export async function reportFriendlyResult(input: unknown): Promise<ReportResult> {
  const parsed = ReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: m } = (await supabase
    .from("matches")
    .select(
      "id, p1_id, p2_id, outcome, tournament_id, confirmed_by_p1, confirmed_by_p2",
    )
    .eq("id", parsed.data.match_id)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          p1_id: string;
          p2_id: string;
          outcome: string;
          tournament_id: string | null;
          confirmed_by_p1: boolean;
          confirmed_by_p2: boolean;
        }
      | null;
  };
  if (!m) return { ok: false, error: "match_not_found" };
  if (m.tournament_id != null) return { ok: false, error: "wrong_state" };
  if (m.outcome !== "scheduled") return { ok: false, error: "wrong_state" };

  const isP1 = m.p1_id === user.id;
  const isP2 = m.p2_id === user.id;
  if (!isP1 && !isP2) return { ok: false, error: "not_authorized" };

  const winner = inferWinnerFromSets(parsed.data.sets);
  if (!winner) return { ok: false, error: "winner_unknown" };

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("matches")
    .update({
      sets: parsed.data.sets,
      winner_side: winner,
      played_at: new Date().toISOString(),
      // Mark the reporter as confirmed; reset opponent so they can confirm/dispute fresh.
      confirmed_by_p1: isP1 ? true : false,
      confirmed_by_p2: isP2 ? true : false,
    } as never)
    .eq("id", parsed.data.match_id);
  if (error) return { ok: false, error: "db_error", message: error.message };

  revalidatePath("/me/matches");
  return { ok: true };
}

// =============================================================================
// Confirm a result the opponent reported. This is the only place where Elo
// recalculation is triggered for friendly matches.
// =============================================================================

export type ConfirmResult =
  | { ok: true; eloDelta: number | null }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "match_not_found"
        | "not_authorized"
        | "wrong_state"
        | "result_not_reported"
        | "already_confirmed"
        | "db_error";
      message?: string;
    };

export async function confirmFriendlyResult(
  matchId: string,
): Promise<ConfirmResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: m } = (await supabase
    .from("matches")
    .select(
      "id, p1_id, p2_id, outcome, tournament_id, sets, winner_side, " +
        "confirmed_by_p1, confirmed_by_p2",
    )
    .eq("id", matchId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          p1_id: string;
          p2_id: string;
          outcome: string;
          tournament_id: string | null;
          sets: unknown;
          winner_side: "p1" | "p2" | null;
          confirmed_by_p1: boolean;
          confirmed_by_p2: boolean;
        }
      | null;
  };
  if (!m) return { ok: false, error: "match_not_found" };
  if (m.tournament_id != null) return { ok: false, error: "wrong_state" };
  if (m.outcome === "completed") return { ok: false, error: "already_confirmed" };
  if (m.outcome !== "scheduled") return { ok: false, error: "wrong_state" };
  if (!m.sets || !m.winner_side) return { ok: false, error: "result_not_reported" };

  const isP1 = m.p1_id === user.id;
  const isP2 = m.p2_id === user.id;
  if (!isP1 && !isP2) return { ok: false, error: "not_authorized" };

  const reporterIsP1 = m.confirmed_by_p1 && !m.confirmed_by_p2;
  const reporterIsP2 = m.confirmed_by_p2 && !m.confirmed_by_p1;
  // Only the *opposite* side can confirm. Reporter can't self-confirm.
  if (isP1 && reporterIsP1) return { ok: false, error: "not_authorized" };
  if (isP2 && reporterIsP2) return { ok: false, error: "not_authorized" };

  const service = createSupabaseServiceClient();
  const { error: upErr } = await service
    .from("matches")
    .update({
      outcome: "completed",
      confirmed_by_p1: true,
      confirmed_by_p2: true,
    } as never)
    .eq("id", matchId);
  if (upErr) return { ok: false, error: "db_error", message: upErr.message };

  // Trigger Elo. Idempotent — safe even if a parallel call also fired.
  let eloDelta: number | null = null;
  const recalc = await recalcMatchElo(service, matchId);
  if (recalc.ok && !recalc.skipped) {
    eloDelta = isP1 ? recalc.p1Delta : recalc.p2Delta;
  }

  revalidatePath("/me/matches");
  revalidatePath("/me/rating");
  return { ok: true, eloDelta };
}

// =============================================================================
// Dispute a result. Clears sets/winner and the reporter's confirmation flag,
// returning the match to a clean "scheduled, no result" state.
// =============================================================================

export type DisputeResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "match_not_found"
        | "not_authorized"
        | "wrong_state"
        | "db_error";
      message?: string;
    };

export async function disputeFriendlyResult(
  matchId: string,
): Promise<DisputeResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: m } = (await supabase
    .from("matches")
    .select(
      "id, p1_id, p2_id, outcome, tournament_id, confirmed_by_p1, confirmed_by_p2",
    )
    .eq("id", matchId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          p1_id: string;
          p2_id: string;
          outcome: string;
          tournament_id: string | null;
          confirmed_by_p1: boolean;
          confirmed_by_p2: boolean;
        }
      | null;
  };
  if (!m) return { ok: false, error: "match_not_found" };
  if (m.tournament_id != null) return { ok: false, error: "wrong_state" };
  if (m.outcome !== "scheduled") return { ok: false, error: "wrong_state" };

  const isP1 = m.p1_id === user.id;
  const isP2 = m.p2_id === user.id;
  if (!isP1 && !isP2) return { ok: false, error: "not_authorized" };

  // Cannot dispute your own report — only the opposite side can.
  if (isP1 && m.confirmed_by_p1) return { ok: false, error: "not_authorized" };
  if (isP2 && m.confirmed_by_p2) return { ok: false, error: "not_authorized" };

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("matches")
    .update({
      sets: null,
      winner_side: null,
      played_at: null,
      confirmed_by_p1: false,
      confirmed_by_p2: false,
    } as never)
    .eq("id", matchId);
  if (error) return { ok: false, error: "db_error", message: error.message };

  revalidatePath("/me/matches");
  return { ok: true };
}

// =============================================================================
// Cancel a scheduled friendly match (no result entered). Either side can do it.
// =============================================================================

export async function cancelScheduledMatch(
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: m } = (await supabase
    .from("matches")
    .select("id, p1_id, p2_id, outcome, tournament_id, sets")
    .eq("id", matchId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          p1_id: string;
          p2_id: string;
          outcome: string;
          tournament_id: string | null;
          sets: unknown;
        }
      | null;
  };
  if (!m) return { ok: false, error: "not_found" };
  if (m.tournament_id != null) return { ok: false, error: "wrong_state" };
  if (m.outcome !== "scheduled") return { ok: false, error: "wrong_state" };
  if (m.sets) return { ok: false, error: "result_already_reported" };
  if (m.p1_id !== user.id && m.p2_id !== user.id)
    return { ok: false, error: "not_authorized" };

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("matches")
    .update({ outcome: "cancelled" } as never)
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/matches");
  return { ok: true };
}

// =============================================================================
// Page payload: my matches grouped by status.
// =============================================================================

export type MatchListItem = {
  id: string;
  outcome: string;
  played_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  is_p1: boolean;
  i_am_winner: boolean | null;
  sets: Array<{
    p1_games: number;
    p2_games: number;
    tiebreak_p1?: number | null;
    tiebreak_p2?: number | null;
  }> | null;
  i_confirmed: boolean;
  opponent_confirmed: boolean;
  reported_by_me: boolean;
  awaiting_my_confirmation: boolean;
  opponent: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    current_elo: number;
    whatsapp: string | null;
  };
  tournament_id: string | null;
  /** Display name of the tournament; null for friendly matches. */
  tournament_name: string | null;
};

export type MyMatchesPayload = {
  awaitingMyConfirmation: MatchListItem[];
  awaitingTheirConfirmation: MatchListItem[];
  scheduled: MatchListItem[];
  recent: MatchListItem[];
};

export async function loadMyMatches(): Promise<MyMatchesPayload | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Pull both friendly AND tournament matches the player is in. Tournament
  // matches are owned by the coach (results entered there + Elo applied
  // automatically), so they are read-only here — they only appear in the
  // "recent" history group, never in the awaiting/scheduled groups.
  // We also include the partner slots for doubles so the player sees pair
  // matches.
  const { data: rows } = (await supabase
    .from("matches")
    .select(
      "id, p1_id, p2_id, p1_partner_id, p2_partner_id, outcome, sets, winner_side, " +
        "played_at, scheduled_at, created_at, confirmed_by_p1, confirmed_by_p2, " +
        "tournament_id",
    )
    .or(
      `p1_id.eq.${user.id},p2_id.eq.${user.id},` +
        `p1_partner_id.eq.${user.id},p2_partner_id.eq.${user.id}`,
    )
    .in("outcome", ["scheduled", "completed", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(120)) as {
    data: Array<{
      id: string;
      p1_id: string;
      p2_id: string;
      p1_partner_id: string | null;
      p2_partner_id: string | null;
      outcome: string;
      sets: MatchListItem["sets"];
      winner_side: "p1" | "p2" | null;
      played_at: string | null;
      scheduled_at: string | null;
      created_at: string;
      confirmed_by_p1: boolean;
      confirmed_by_p2: boolean;
      tournament_id: string | null;
    }> | null;
  };

  const list = rows ?? [];

  // Resolve the "main opponent" for each row.
  //   - If the viewer is on side P1 (either p1_id or p1_partner_id), the
  //     opponent is p2_id (we show the captain of the other side).
  //   - Otherwise the viewer is on side P2 and the opponent is p1_id.
  // is_p1 is used downstream to compare winner_side, so it must reflect the
  // viewer's side, not just whether they are the captain.
  const sideOf = (m: (typeof list)[number]) =>
    m.p1_id === user.id || m.p1_partner_id === user.id ? "p1" : "p2";

  const otherIds = Array.from(
    new Set(list.map((m) => (sideOf(m) === "p1" ? m.p2_id : m.p1_id))),
  );

  const peopleById = new Map<string, MatchListItem["opponent"]>();
  if (otherIds.length > 0) {
    const { data: people } = (await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, current_elo, whatsapp")
      .in("id", otherIds)) as {
      data: Array<MatchListItem["opponent"]> | null;
    };
    for (const p of people ?? []) peopleById.set(p.id, p);
  }

  // Resolve tournament names for any tournament rows we received.
  const tournamentIds = Array.from(
    new Set(
      list
        .map((m) => m.tournament_id)
        .filter((x): x is string => x != null),
    ),
  );
  const tournamentNameById = new Map<string, string>();
  if (tournamentIds.length > 0) {
    const { data: tours } = (await supabase
      .from("tournaments")
      .select("id, name")
      .in("id", tournamentIds)) as {
      data: Array<{ id: string; name: string }> | null;
    };
    for (const t of tours ?? []) tournamentNameById.set(t.id, t.name);
  }

  const items: MatchListItem[] = list.flatMap((m) => {
    const side = sideOf(m);
    const isP1 = side === "p1";
    const otherId = isP1 ? m.p2_id : m.p1_id;
    const opponent = peopleById.get(otherId);
    if (!opponent) return [];
    const iConfirmed = isP1 ? m.confirmed_by_p1 : m.confirmed_by_p2;
    const otherConfirmed = isP1 ? m.confirmed_by_p2 : m.confirmed_by_p1;
    const hasResult = m.sets != null && m.winner_side != null;
    const reportedByMe = hasResult && iConfirmed;
    const awaitingMyConfirmation =
      m.outcome === "scheduled" && hasResult && !iConfirmed && otherConfirmed;
    const iAmWinner =
      m.winner_side == null
        ? null
        : (m.winner_side === "p1") === isP1
          ? true
          : false;
    return [
      {
        id: m.id,
        outcome: m.outcome,
        played_at: m.played_at,
        scheduled_at: m.scheduled_at,
        created_at: m.created_at,
        is_p1: isP1,
        i_am_winner: iAmWinner,
        sets: m.sets,
        i_confirmed: iConfirmed,
        opponent_confirmed: otherConfirmed,
        reported_by_me: reportedByMe,
        awaiting_my_confirmation: awaitingMyConfirmation,
        opponent,
        tournament_id: m.tournament_id,
        tournament_name: m.tournament_id
          ? (tournamentNameById.get(m.tournament_id) ?? null)
          : null,
      },
    ];
  });

  // Tournament matches are managed by the coach — they only surface in the
  // "recent" history list. The awaiting/scheduled groups are friendly-only.
  const friendly = items.filter((m) => m.tournament_id == null);

  return {
    awaitingMyConfirmation: friendly.filter((m) => m.awaiting_my_confirmation),
    awaitingTheirConfirmation: friendly.filter(
      (m) =>
        m.outcome === "scheduled" &&
        m.sets != null &&
        m.reported_by_me &&
        !m.opponent_confirmed,
    ),
    scheduled: friendly.filter(
      (m) => m.outcome === "scheduled" && m.sets == null,
    ),
    // Recent = any completed/cancelled match (friendly OR tournament).
    // Tournament `scheduled` rows that haven't been played yet are hidden
    // here; the player sees them in /me/tournaments.
    recent: items.filter(
      (m) => m.outcome === "completed" || m.outcome === "cancelled",
    ),
  };
}

// =============================================================================
// Opponent picker: list of recent / nearby players to choose from.
// Reuses the visibility flags from the "Find a Player" pre-filter, but
// bypasses Elo radius — friendly registration shouldn't be gated on rating.
// =============================================================================

export type OpponentOption = {
  id: string;
  display_name: string | null;
  city: string | null;
  current_elo: number;
};

export async function loadOpponentOptions(query: string): Promise<OpponentOption[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let q = supabase
    .from("profiles")
    .select("id, display_name, city, current_elo")
    .eq("visible_in_find_player", true)
    .neq("id", user.id)
    .order("display_name", { ascending: true })
    .limit(40);

  const term = query.trim();
  if (term.length >= 2) {
    q = q.ilike("display_name", `%${term}%`);
  }

  const { data } = (await q) as { data: OpponentOption[] | null };
  return data ?? [];
}
