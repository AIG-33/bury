"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  UpdateClubBrandingSchema,
  clubBrandingFromRow,
  type ClubBranding,
} from "@/lib/validators/club-branding";

type Result<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/**
 * The club owner or an approved co-admin may edit branding — the same gate
 * as the clubs write RLS, checked in code for a friendly error code.
 */
async function requireClubAdmin(clubId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };

  const { data: club } = (await supabase
    .from("clubs")
    .select("id, slug, owner_id")
    .eq("id", clubId)
    .maybeSingle()) as { data: { id: string; slug: string; owner_id: string } | null };
  if (!club) return { ok: false as const, error: "not_found" as const };

  let isAdmin = club.owner_id === user.id;
  if (!isAdmin) {
    const { data: cm } = (await supabase
      .from("club_members")
      .select("role, status")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .maybeSingle()) as { data: { role: string; status: string } | null };
    isAdmin = cm?.role === "admin" && cm?.status === "approved";
  }
  if (!isAdmin) return { ok: false as const, error: "not_owner" as const };

  return { ok: true as const, supabase, userId: user.id, club };
}

export async function loadClubBranding(clubId: string): Promise<ClubBranding> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    .from("clubs")
    .select("branding")
    .eq("id", clubId)
    .maybeSingle()) as { data: { branding: unknown } | null };
  return clubBrandingFromRow(data?.branding);
}

export async function updateClubBranding(input: unknown): Promise<Result> {
  const parsed = UpdateClubBrandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { club_id, branding } = parsed.data;

  const auth = await requireClubAdmin(club_id);
  if (!auth.ok) return { ok: false, error: auth.error };

  // The editor is seeded with the legacy brand_color / cover_url folded into
  // the blob (clubBrandingWithLegacy), so after the first save the blob is the
  // single source of truth — clear the legacy columns to avoid double-styling.
  const { error } = await auth.supabase
    .from("clubs")
    .update({ branding, brand_color: null, cover_url: null } as never)
    .eq("id", club_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clubs/${auth.club.slug}`);
  revalidatePath(`/m/clubs/${auth.club.slug}`);
  revalidatePath(`/me/clubs/owned/${club_id}`);
  return { ok: true };
}
