"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ApplyToOpenMatchSchema,
  CreateOpenMatchSchema,
  OpenMatchesFilterSchema,
  type ApplyToOpenMatchInput,
  type CreateOpenMatchInput,
  type OpenMatchApplicationRow,
  type OpenMatchFeedRow,
  type OpenMatchesFilter,
} from "@/lib/open-matches/schema";

// =============================================================================
// Phase D — Server actions for Open Matches.
// =============================================================================
//
// All actions return a discriminated `{ ok: true, ... } | { ok: false, error }`
// envelope (per AGENTS §4) so the form layer can render localized errors
// without sniffing exception messages.
// =============================================================================

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Public list — anyone (incl. anon) can read upcoming open matches.
// ---------------------------------------------------------------------------

export async function loadOpenMatches(
  input: Partial<OpenMatchesFilter> = {},
): Promise<{ rows: OpenMatchFeedRow[] }> {
  const filters = OpenMatchesFilterSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const fromIso = filters.from ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const status = filters.status ?? "open";

  let q = supabase
    .from("open_matches_feed")
    .select(
      "id, creator_id, creator_name, creator_avatar, creator_elo, creator_elo_status, " +
        "venue_id, venue_name, venue_city, venue_is_indoor, venue_indoor_status, " +
        "district_id, district_name, " +
        "starts_at, duration_min, format, level_band, slots_needed, notes, status, created_at, " +
        "pending_applications_count, accepted_applications_count",
    )
    .eq("status", status)
    .gte("starts_at", fromIso)
    .order("starts_at", { ascending: true })
    .limit(80);

  if (filters.venue_id) q = q.eq("venue_id", filters.venue_id);
  if (filters.district_id) q = q.eq("district_id", filters.district_id);
  if (filters.level_band && filters.level_band !== "any") q = q.eq("level_band", filters.level_band);
  if (filters.format) q = q.eq("format", filters.format);
  if (filters.to) q = q.lte("starts_at", filters.to);

  const { data } = (await q) as { data: OpenMatchFeedRow[] | null };
  return { rows: data ?? [] };
}

// ---------------------------------------------------------------------------
// Single row + applications (creator sees full list; others see public summary).
// ---------------------------------------------------------------------------

export type OpenMatchDetail = {
  match: OpenMatchFeedRow;
  isCreator: boolean;
  myApplication: OpenMatchApplicationRow | null;
  applications: OpenMatchApplicationRow[];
};

export async function loadOpenMatch(id: string): Promise<OpenMatchDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: match } = (await supabase
    .from("open_matches_feed")
    .select(
      "id, creator_id, creator_name, creator_avatar, creator_elo, creator_elo_status, " +
        "venue_id, venue_name, venue_city, venue_is_indoor, venue_indoor_status, " +
        "district_id, district_name, " +
        "starts_at, duration_min, format, level_band, slots_needed, notes, status, created_at, " +
        "pending_applications_count, accepted_applications_count",
    )
    .eq("id", id)
    .maybeSingle()) as { data: OpenMatchFeedRow | null };

  if (!match) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isCreator = user != null && user.id === match.creator_id;

  // Read applications. RLS filters to (applicant=me OR creator-of-parent),
  // so the creator gets all rows; a regular user only their own.
  const { data: rawApps } = (await supabase
    .from("open_match_applications")
    .select(
      "id, open_match_id, applicant_id, message, status, created_at, decided_at, " +
        "profiles!open_match_applications_applicant_id_fkey(display_name, avatar_url, current_elo)",
    )
    .eq("open_match_id", id)
    .order("created_at", { ascending: true })) as {
    data: Array<{
      id: string;
      open_match_id: string;
      applicant_id: string;
      message: string | null;
      status: OpenMatchApplicationRow["status"];
      created_at: string;
      decided_at: string | null;
      profiles: {
        display_name: string | null;
        avatar_url: string | null;
        current_elo: number;
      } | null;
    }> | null;
  };

  const applications: OpenMatchApplicationRow[] = (rawApps ?? []).map((a) => ({
    id: a.id,
    open_match_id: a.open_match_id,
    applicant_id: a.applicant_id,
    applicant_name: a.profiles?.display_name ?? null,
    applicant_avatar: a.profiles?.avatar_url ?? null,
    applicant_elo: a.profiles?.current_elo ?? 0,
    message: a.message,
    status: a.status,
    created_at: a.created_at,
    decided_at: a.decided_at,
  }));

  const myApplication =
    user == null ? null : (applications.find((a) => a.applicant_id === user.id) ?? null);

  return { match, isCreator, myApplication, applications };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createOpenMatch(input: CreateOpenMatchInput): Promise<Result<{ id: string }>> {
  const parsed = CreateOpenMatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = (await supabase
    .from("open_matches")
    .insert({
      creator_id: user.id,
      venue_id: parsed.data.venue_id ?? null,
      district_id: parsed.data.district_id ?? null,
      starts_at: parsed.data.starts_at,
      duration_min: parsed.data.duration_min,
      format: parsed.data.format,
      level_band: parsed.data.level_band,
      slots_needed: parsed.data.slots_needed,
      notes: parsed.data.notes,
    } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !data) {
    console.error("open_matches.insert", { user_id: user.id, message: error?.message });
    return { ok: false, error: error?.message ?? "db_error" };
  }

  revalidatePath("/open-matches");
  if (parsed.data.venue_id) revalidatePath(`/venues/${parsed.data.venue_id}`);
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Cancel — creator pulls their post.
// ---------------------------------------------------------------------------

export async function cancelOpenMatch(id: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("open_matches")
    .update({ status: "cancelled" } as never)
    .eq("id", id)
    .eq("creator_id", user.id)
    .in("status", ["open", "filled"]); // can't cancel an already cancelled/expired one

  if (error) {
    console.error("open_matches.cancel", { user_id: user.id, id, message: error.message });
    return { ok: false, error: error.message };
  }

  revalidatePath("/open-matches");
  revalidatePath(`/open-matches/${id}`);
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export async function applyToOpenMatch(
  input: ApplyToOpenMatchInput,
): Promise<Result<{ id: string }>> {
  const parsed = ApplyToOpenMatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // RLS will reject self-apply / closed matches; we still produce a friendlier
  // error by checking up-front.
  const { data: parent } = (await supabase
    .from("open_matches")
    .select("creator_id, status")
    .eq("id", parsed.data.open_match_id)
    .maybeSingle()) as { data: { creator_id: string; status: string } | null };
  if (!parent) return { ok: false, error: "open_match_not_found" };
  if (parent.creator_id === user.id) return { ok: false, error: "cannot_apply_to_own" };
  if (parent.status !== "open") return { ok: false, error: "open_match_closed" };

  const { data, error } = (await supabase
    .from("open_match_applications")
    .insert({
      open_match_id: parsed.data.open_match_id,
      applicant_id: user.id,
      message: parsed.data.message,
    } as never)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: ({ message: string; code?: string } & Record<string, unknown>) | null;
  };

  if (error || !data) {
    // 23505 = unique_violation → already applied.
    if (error && (error as { code?: string }).code === "23505") {
      return { ok: false, error: "already_applied" };
    }
    console.error("open_match_apps.insert", {
      user_id: user.id,
      open_match_id: parsed.data.open_match_id,
      message: error?.message,
    });
    return { ok: false, error: error?.message ?? "db_error" };
  }

  revalidatePath(`/open-matches/${parsed.data.open_match_id}`);
  revalidatePath("/open-matches");
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Withdraw — applicant pulls their own application.
// ---------------------------------------------------------------------------

export async function withdrawApplication(id: string): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error, data } = (await supabase
    .from("open_match_applications")
    .update({ status: "withdrawn", decided_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("applicant_id", user.id)
    .eq("status", "pending")
    .select("open_match_id")
    .maybeSingle()) as {
    error: { message: string } | null;
    data: { open_match_id: string } | null;
  };

  if (error) return { ok: false, error: error.message };
  if (data?.open_match_id) {
    revalidatePath(`/open-matches/${data.open_match_id}`);
  }
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Decide — creator accepts or rejects an application.
// ---------------------------------------------------------------------------

export async function decideApplication(
  applicationId: string,
  decision: "accepted" | "rejected",
): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: app } = (await supabase
    .from("open_match_applications")
    .select("id, open_match_id, status, open_matches!inner(creator_id, status, slots_needed)")
    .eq("id", applicationId)
    .maybeSingle()) as {
    data: {
      id: string;
      open_match_id: string;
      status: string;
      open_matches: { creator_id: string; status: string; slots_needed: number };
    } | null;
  };

  if (!app) return { ok: false, error: "application_not_found" };
  if (app.open_matches.creator_id !== user.id) return { ok: false, error: "not_creator" };
  if (app.status !== "pending") return { ok: false, error: "already_decided" };

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("open_match_applications")
    .update({ status: decision, decided_at: nowIso } as never)
    .eq("id", applicationId);

  if (error) return { ok: false, error: error.message };

  // If we just accepted enough applicants to fill the post, flip parent to filled.
  if (decision === "accepted") {
    const { count } = await supabase
      .from("open_match_applications")
      .select("id", { count: "exact", head: true })
      .eq("open_match_id", app.open_match_id)
      .eq("status", "accepted");

    if ((count ?? 0) >= app.open_matches.slots_needed) {
      await supabase
        .from("open_matches")
        .update({ status: "filled" } as never)
        .eq("id", app.open_match_id)
        .eq("status", "open");
    }
  }

  revalidatePath(`/open-matches/${app.open_match_id}`);
  revalidatePath("/open-matches");
  return { ok: true, data: null };
}
