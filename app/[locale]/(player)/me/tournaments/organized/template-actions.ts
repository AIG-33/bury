"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SaveTemplateSchema,
  templatePayloadFromRow,
  type TournamentTemplatePayload,
} from "@/lib/tournaments/template-schema";

// =============================================================================
// Tournament templates — save / list / delete. Visibility is enforced by the
// RLS on `tournament_templates`: the creator always sees their templates, a
// club-bound template is also visible to that club's owner + co-admins.
// =============================================================================

export type TemplateRow = {
  id: string;
  name: string;
  club_id: string | null;
  club_name: string | null;
  owner_id: string;
  is_mine: boolean;
  /** Null when the stored payload was written by an older app version and no
   * longer matches the schema — such a template can be deleted but not used. */
  payload: TournamentTemplatePayload | null;
  created_at: string;
};

type SaveResult = { ok: true; id: string } | { ok: false; error: string };

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

type DbTemplateRow = {
  id: string;
  name: string;
  club_id: string | null;
  owner_id: string;
  payload: unknown;
  created_at: string;
  clubs: { name: string } | Array<{ name: string }> | null;
};

function toTemplateRow(r: DbTemplateRow, userId: string): TemplateRow {
  const club = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs;
  return {
    id: r.id,
    name: r.name,
    club_id: r.club_id,
    club_name: club?.name ?? null,
    owner_id: r.owner_id,
    is_mine: r.owner_id === userId,
    payload: templatePayloadFromRow(r.payload),
    created_at: r.created_at,
  };
}

/** Every template the current user can see (personal + shared via clubs). */
export async function loadMyTemplates(): Promise<
  { ok: true; templates: TemplateRow[] } | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data } = (await supabase
    .from("tournament_templates")
    .select("id, name, club_id, owner_id, payload, created_at, clubs(name)")
    .order("created_at", { ascending: false })) as { data: DbTemplateRow[] | null };

  return { ok: true, templates: (data ?? []).map((r) => toTemplateRow(r, userId)) };
}

/** Templates bound to one club — the club organizer panel's list. */
export async function loadClubTemplates(
  clubId: string,
): Promise<{ ok: true; templates: TemplateRow[] } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  if (!(await userAdministersClub(supabase, userId, clubId))) {
    return { ok: false, error: "not_club_admin" };
  }

  const { data } = (await supabase
    .from("tournament_templates")
    .select("id, name, club_id, owner_id, payload, created_at, clubs(name)")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })) as { data: DbTemplateRow[] | null };

  return { ok: true, templates: (data ?? []).map((r) => toTemplateRow(r, userId)) };
}

export async function saveTemplate(input: unknown): Promise<SaveResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const parsed = SaveTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;

  if (v.club_id && !(await userAdministersClub(supabase, userId, v.club_id))) {
    return { ok: false, error: "not_club_admin" };
  }

  const { data, error } = (await supabase
    .from("tournament_templates")
    .insert({
      owner_id: userId,
      club_id: v.club_id,
      name: v.name,
      payload: v.payload,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };

  revalidatePath("/me/tournaments/organized");
  if (v.club_id) revalidatePath(`/me/clubs/owned/${v.club_id}`);
  return { ok: true, id: data.id };
}

export async function deleteTemplate(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  // Read the row first (RLS-scoped) so we know which club page to revalidate
  // and can distinguish "not found / not allowed" from a DB failure.
  const { data: existing } = (await supabase
    .from("tournament_templates")
    .select("id, club_id")
    .eq("id", id)
    .maybeSingle()) as { data: { id: string; club_id: string | null } | null };
  if (!existing) return { ok: false, error: "not_found" };

  const { error } = await supabase.from("tournament_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/tournaments/organized");
  if (existing.club_id) revalidatePath(`/me/clubs/owned/${existing.club_id}`);
  return { ok: true };
}
