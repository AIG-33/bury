"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  rankCandidates,
  type FindPlayerCandidate,
  type FindPlayerFilters,
  type SeekerContext,
  type ScoredCandidate,
} from "@/lib/matching/find-player";
import {
  AvailabilitySchema,
  EMPTY_AVAILABILITY,
  EMPTY_SOCIAL_LINKS,
  TIME_SLOTS,
  WEEKDAYS,
  type Availability,
  type SocialLinks,
} from "@/lib/profile/schema";
import { sendEmail } from "@/lib/email/send";
import { buildMatchProposalEmail } from "@/lib/email/templates/match-proposal";

// =============================================================================
// Filter validation
// =============================================================================

const FiltersSchema = z.object({
  districtIds: z.array(z.string().uuid()).max(20).default([]),
  eloRadius: z.coerce.number().int().min(25).max(600).default(100),
  desiredSlots: z
    .array(
      z.object({
        weekday: z.enum(WEEKDAYS),
        daypart: z.enum(TIME_SLOTS),
      }),
    )
    .max(35)
    .default([]),
  hand: z.enum(["R", "L", "both"]).default("both"),
  query: z.string().trim().max(80).default(""),
});

export type SearchInput = z.input<typeof FiltersSchema>;

// =============================================================================
// District options (used by the filter UI)
// =============================================================================

export type DistrictOption = { id: string; name: string };

export async function loadDistrictOptions(): Promise<DistrictOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("districts")
    .select("id, name, city")
    .eq("country", "PL")
    .order("city", { ascending: true })) as {
    data: Array<{ id: string; name: string; city: string }> | null;
  };
  return (data ?? []).map((d) => ({ id: d.id, name: `${d.city} · ${d.name}` }));
}

// =============================================================================
// My availability (own schedule, persisted on profiles.availability)
// =============================================================================

export type LoadMyAvailabilityResult =
  | { ok: true; availability: Availability }
  | { ok: false; error: "not_authenticated" | "no_profile" };

export async function loadMyAvailability(): Promise<LoadMyAvailabilityResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: row } = (await supabase
    .from("profiles")
    .select("availability")
    .eq("id", user.id)
    .single()) as {
    data: { availability: Partial<Availability> | null } | null;
  };
  if (!row) return { ok: false, error: "no_profile" };

  return {
    ok: true,
    availability: {
      ...EMPTY_AVAILABILITY,
      ...(row.availability ?? {}),
    } as Availability,
  };
}

export type UpdateAvailabilityResult =
  | { ok: true; availability: Availability }
  | {
      ok: false;
      error: "not_authenticated" | "invalid_payload" | "db_error";
      message?: string;
    };

export async function updateMyAvailability(
  input: unknown,
): Promise<UpdateAvailabilityResult> {
  const parsed = AvailabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ availability: parsed.data } as never)
    .eq("id", user.id);

  if (error) return { ok: false, error: "db_error", message: error.message };

  revalidatePath("/me/find");
  revalidatePath("/me/profile");
  return { ok: true, availability: parsed.data as Availability };
}

// =============================================================================
// Main search
// =============================================================================

export type SearchResult =
  | { ok: true; results: ScoredCandidate[]; seeker: SeekerContext }
  | { ok: false; error: "not_authenticated" | "no_profile" };

const MAX_CANDIDATES = 80;

export async function searchOpponents(input: SearchInput): Promise<SearchResult> {
  const filters = FiltersSchema.parse(input) as FindPlayerFilters;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: meRow } = (await supabase
    .from("profiles")
    .select("id, current_elo, district_id, availability")
    .eq("id", user.id)
    .single()) as {
    data:
      | {
          id: string;
          current_elo: number;
          district_id: string | null;
          availability: Partial<Availability> | null;
        }
      | null;
  };
  if (!meRow) return { ok: false, error: "no_profile" };

  const seeker: SeekerContext = {
    id: meRow.id,
    current_elo: meRow.current_elo,
    district_id: meRow.district_id,
    availability: { ...EMPTY_AVAILABILITY, ...(meRow.availability ?? {}) } as Availability,
  };

  // SQL pre-filter: visibility + Elo range + optional district set.
  let q = supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, city, district_id, current_elo, elo_status, " +
        "rated_matches_count, dominant_hand, backhand_style, favorite_surface, " +
        "whatsapp, telegram_username, social_links, availability, last_match_at",
    )
    .eq("visible_in_find_player", true)
    .neq("id", seeker.id)
    .gte("current_elo", seeker.current_elo - filters.eloRadius)
    .lte("current_elo", seeker.current_elo + filters.eloRadius)
    .limit(MAX_CANDIDATES);

  if (filters.districtIds.length > 0) {
    q = q.in("district_id", filters.districtIds);
  }

  const { data: rawCandidates } = (await q) as {
    data: Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      city: string | null;
      district_id: string | null;
      current_elo: number;
      elo_status: "provisional" | "established";
      rated_matches_count: number;
      dominant_hand: "R" | "L" | null;
      backhand_style: "one_handed" | "two_handed" | null;
      favorite_surface: "hard" | "clay" | "grass" | "carpet" | null;
      whatsapp: string | null;
      telegram_username: string | null;
      social_links: Partial<SocialLinks> | null;
      availability: Partial<Availability> | null;
      last_match_at: string | null;
    }> | null;
  };

  // District names lookup (one extra query, cheap thanks to small set).
  const districtIds = Array.from(
    new Set(
      (rawCandidates ?? [])
        .map((c) => c.district_id)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const districtNames = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as { data: Array<{ id: string; name: string }> | null };
    for (const d of ds ?? []) districtNames.set(d.id, d.name);
  }

  // Pending-proposal exclusion: hide people we already have an active proposal with.
  const { data: pending } = (await supabase
    .from("matches")
    .select("p1_id, p2_id")
    .eq("outcome", "proposed")
    .is("tournament_id", null)
    .or(`p1_id.eq.${seeker.id},p2_id.eq.${seeker.id}`)) as {
    data: Array<{ p1_id: string; p2_id: string }> | null;
  };
  const excludeIds = new Set<string>();
  for (const m of pending ?? []) {
    excludeIds.add(m.p1_id);
    excludeIds.add(m.p2_id);
  }
  excludeIds.delete(seeker.id);

  const now = Date.now();
  const candidates: FindPlayerCandidate[] = (rawCandidates ?? []).map((c) => ({
    id: c.id,
    display_name: c.display_name,
    avatar_url: c.avatar_url,
    city: c.city,
    district_id: c.district_id,
    district_name: c.district_id ? (districtNames.get(c.district_id) ?? null) : null,
    current_elo: c.current_elo,
    elo_status: c.elo_status,
    rated_matches_count: c.rated_matches_count,
    dominant_hand: c.dominant_hand,
    backhand_style: c.backhand_style,
    favorite_surface: c.favorite_surface,
    whatsapp: c.whatsapp,
    telegram_username: c.telegram_username,
    social_links: { ...EMPTY_SOCIAL_LINKS, ...(c.social_links ?? {}) },
    availability: { ...EMPTY_AVAILABILITY, ...(c.availability ?? {}) } as Availability,
    days_since_last_match:
      c.last_match_at != null
        ? Math.floor((now - Date.parse(c.last_match_at)) / (24 * 60 * 60 * 1000))
        : null,
  }));

  const ranked = rankCandidates(candidates, seeker, filters, excludeIds).slice(0, 50);

  return { ok: true, results: ranked, seeker };
}

// =============================================================================
// Propose / respond
// =============================================================================

const ProposeSchema = z.object({
  opponent_id: z.string().uuid(),
  message: z.string().trim().max(500).optional().nullable(),
});

export type ProposeResult =
  | { ok: true; match_id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_payload"
        | "self_propose"
        | "duplicate_proposal"
        | "opponent_not_found"
        | "db_error";
      message?: string;
    };

export async function proposeMatch(input: unknown): Promise<ProposeResult> {
  const parsed = ProposeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { opponent_id, message } = parsed.data;
  if (opponent_id === user.id) return { ok: false, error: "self_propose" };

  // Look up opponent (need email + locale + display name + visibility).
  const { data: opponent } = (await supabase
    .from("profiles")
    .select(
      "id, display_name, locale, current_elo, visible_in_find_player, notification_email",
    )
    .eq("id", opponent_id)
    .single()) as {
    data: {
      id: string;
      display_name: string | null;
      locale: "pl" | "en" | "ru";
      current_elo: number;
      visible_in_find_player: boolean;
      notification_email: boolean;
    } | null;
  };
  if (!opponent) return { ok: false, error: "opponent_not_found" };

  // Look up self (for the email body).
  const { data: me } = (await supabase
    .from("profiles")
    .select("display_name, current_elo, locale")
    .eq("id", user.id)
    .single()) as {
    data: {
      display_name: string | null;
      current_elo: number;
      locale: "pl" | "en" | "ru";
    } | null;
  };

  // Insert via service client to bypass RLS quirks on partial-unique conflicts
  // (we want to surface `duplicate_proposal` cleanly).
  const service = createSupabaseServiceClient();
  const { data: inserted, error } = (await service
    .from("matches")
    .insert({
      p1_id: user.id,
      p2_id: opponent_id,
      outcome: "proposed",
      is_doubles: false,
      proposal_message: message ?? null,
    } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { code?: string; message: string } | null };

  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate_proposal" };
    return { ok: false, error: "db_error", message: error.message };
  }
  if (!inserted) return { ok: false, error: "db_error" };

  // Outbox row + best-effort send (email primary; WhatsApp will be Phase 2).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const proposalUrl = `${siteUrl}/${opponent.locale}/me/find/proposals`;
  const initiatorName = me?.display_name ?? "A tennis player";
  const tpl = buildMatchProposalEmail({
    initiatorName,
    initiatorElo: me?.current_elo ?? 1000,
    message: message ?? null,
    proposalUrl,
    locale: opponent.locale,
  });

  await service.from("notifications_outbox").insert({
    recipient_id: opponent.id,
    channel: "email",
    template: "match_proposal",
    locale: opponent.locale,
    payload: {
      match_id: inserted.id,
      initiator_name: initiatorName,
      initiator_elo: me?.current_elo ?? 1000,
      message: message ?? null,
      url: proposalUrl,
    },
    status: opponent.notification_email ? "pending" : "cancelled",
  } as never);

  if (opponent.notification_email) {
    // Need recipient email — comes from auth.users, fetched via admin API.
    const { data: authUser } = await service.auth.admin.getUserById(opponent.id);
    const recipientEmail = authUser?.user?.email;
    if (recipientEmail) {
      const result = await sendEmail({
        to: recipientEmail,
        subject: tpl.subject,
        html: tpl.html,
      });
      if (result.ok) {
        await service
          .from("notifications_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString() } as never)
          .eq("recipient_id", opponent.id)
          .eq("template", "match_proposal")
          .eq("payload->>match_id", inserted.id);
      }
    }
  }

  revalidatePath("/me/find");
  revalidatePath("/me/find/proposals");
  return { ok: true, match_id: inserted.id };
}

const RespondSchema = z.object({
  match_id: z.string().uuid(),
  decision: z.enum(["accept", "decline", "cancel"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export type RespondResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_payload"
        | "match_not_found"
        | "not_authorized"
        | "wrong_state"
        | "db_error";
      message?: string;
    };

export async function respondToProposal(input: unknown): Promise<RespondResult> {
  const parsed = RespondSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { match_id, decision, note } = parsed.data;

  const { data: m } = (await supabase
    .from("matches")
    .select("id, p1_id, p2_id, outcome, tournament_id")
    .eq("id", match_id)
    .single()) as {
    data: {
      id: string;
      p1_id: string;
      p2_id: string;
      outcome: string;
      tournament_id: string | null;
    } | null;
  };
  if (!m) return { ok: false, error: "match_not_found" };
  if (m.outcome !== "proposed") return { ok: false, error: "wrong_state" };
  if (m.tournament_id !== null) return { ok: false, error: "wrong_state" };

  const isInitiator = m.p1_id === user.id;
  const isRecipient = m.p2_id === user.id;
  if (!isInitiator && !isRecipient) return { ok: false, error: "not_authorized" };

  // Initiator can only "cancel"; recipient can "accept" or "decline".
  if (isInitiator && decision !== "cancel") return { ok: false, error: "not_authorized" };
  if (isRecipient && decision === "cancel") return { ok: false, error: "not_authorized" };

  const newOutcome =
    decision === "accept" ? "scheduled" : decision === "decline" ? "cancelled" : "cancelled";

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("matches")
    .update({
      outcome: newOutcome,
      proposal_responded_at: new Date().toISOString(),
      proposal_response_note: note ?? null,
    } as never)
    .eq("id", match_id);

  if (error) return { ok: false, error: "db_error", message: error.message };

  revalidatePath("/me/find");
  revalidatePath("/me/find/proposals");
  return { ok: true };
}

// =============================================================================
// Proposals page payload
// =============================================================================

export type ProposalRow = {
  id: string;
  outcome: "proposed" | "scheduled" | "cancelled" | string;
  proposal_message: string | null;
  proposal_response_note: string | null;
  proposal_responded_at: string | null;
  created_at: string;
  other: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    current_elo: number;
    city: string | null;
    whatsapp: string | null;
  };
  is_initiator: boolean;
};

export async function loadMyProposals(): Promise<{
  incoming: ProposalRow[];
  sent: ProposalRow[];
  history: ProposalRow[];
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = (await supabase
    .from("matches")
    .select(
      "id, p1_id, p2_id, outcome, proposal_message, proposal_response_note, " +
        "proposal_responded_at, created_at",
    )
    .is("tournament_id", null)
    .or(`p1_id.eq.${user.id},p2_id.eq.${user.id}`)
    .in("outcome", ["proposed", "scheduled", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(60)) as {
    data: Array<{
      id: string;
      p1_id: string;
      p2_id: string;
      outcome: string;
      proposal_message: string | null;
      proposal_response_note: string | null;
      proposal_responded_at: string | null;
      created_at: string;
    }> | null;
  };

  const otherIds = Array.from(
    new Set(
      (rows ?? []).map((m) => (m.p1_id === user.id ? m.p2_id : m.p1_id)),
    ),
  );

  const peopleById = new Map<string, ProposalRow["other"]>();
  if (otherIds.length > 0) {
    const { data: people } = (await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, current_elo, city, whatsapp")
      .in("id", otherIds)) as {
      data: Array<ProposalRow["other"]> | null;
    };
    for (const p of people ?? []) peopleById.set(p.id, p);
  }

  const all: ProposalRow[] = (rows ?? []).flatMap((m) => {
    const isInitiator = m.p1_id === user.id;
    const otherId = isInitiator ? m.p2_id : m.p1_id;
    const other = peopleById.get(otherId);
    if (!other) return [];
    return [
      {
        id: m.id,
        outcome: m.outcome,
        proposal_message: m.proposal_message,
        proposal_response_note: m.proposal_response_note,
        proposal_responded_at: m.proposal_responded_at,
        created_at: m.created_at,
        other,
        is_initiator: isInitiator,
      },
    ];
  });

  return {
    incoming: all.filter((r) => !r.is_initiator && r.outcome === "proposed"),
    sent: all.filter((r) => r.is_initiator && r.outcome === "proposed"),
    history: all.filter((r) => r.outcome !== "proposed"),
  };
}

