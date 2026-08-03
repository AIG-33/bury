"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserVenueFormSchema, type UserVenueCourt } from "@/lib/venues/schema";

// =============================================================================
// User-created venues («Добавить площадку»).
//
// Any authenticated user can add a venue; the creator can edit their own
// venue afterwards. RLS enforces both (venues_user_insert /
// venues_creator_update + courts_creator_write), the explicit checks here
// only produce cleaner error codes for the UI.
//
// Admin-seeded venues (created_by IS NULL) stay editable through the admin
// panel only — this module never touches them.
// =============================================================================

export type SaveUserVenueResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createUserVenue(input: unknown): Promise<SaveUserVenueResult> {
  const parsed = UserVenueFormSchema.safeParse(input);
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

  const v = parsed.data;
  const { data: venue, error } = (await supabase
    .from("venues")
    .insert({
      name: v.name,
      city: v.city,
      country: v.country,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      amenities: v.amenities,
      website: v.website,
      phone: v.phone,
      photos: v.photo_url ? [v.photo_url] : [],
      created_by: user.id,
    } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !venue) return { ok: false, error: error?.message ?? "db_error" };

  const courtsError = await insertCourts(supabase, venue.id, v.courts);
  if (courtsError) return { ok: false, error: courtsError };

  revalidatePath("/venues");
  return { ok: true, id: venue.id };
}

const UpdateUserVenueInput = z.object({ id: z.string().uuid() }).and(UserVenueFormSchema);

export async function updateUserVenue(input: unknown): Promise<SaveUserVenueResult> {
  const parsed = UpdateUserVenueInput.safeParse(input);
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

  const { id, ...v } = parsed.data;

  const allowed = await canEditVenue(supabase, id, user.id);
  if (!allowed) return { ok: false, error: "not_allowed" };

  const { error } = await supabase
    .from("venues")
    .update({
      name: v.name,
      city: v.city,
      country: v.country,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      amenities: v.amenities,
      website: v.website,
      phone: v.phone,
      photos: v.photo_url ? [v.photo_url] : [],
    } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const syncError = await syncCourts(supabase, id, v.courts);
  if (syncError) return { ok: false, error: syncError };

  revalidatePath("/venues");
  revalidatePath(`/venues/${id}`);
  return { ok: true, id };
}

// -----------------------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function canEditVenue(
  supabase: AnySupabase,
  venueId: string,
  userId: string,
): Promise<boolean> {
  const { data: venue } = (await supabase
    .from("venues")
    .select("id, created_by")
    .eq("id", venueId)
    .maybeSingle()) as { data: { id: string; created_by: string | null } | null };
  if (!venue) return false;
  if (venue.created_by === userId) return true;

  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  return profile?.is_admin === true;
}

async function insertCourts(
  supabase: AnySupabase,
  venueId: string,
  courts: UserVenueCourt[],
): Promise<string | null> {
  if (courts.length === 0) return null;
  const rows = courts.map((c) => ({
    venue_id: venueId,
    number: c.number,
    name: c.name,
    surface: c.surface ?? null,
    status: "active",
    is_indoor: c.is_indoor,
  }));
  const { error } = await supabase.from("courts").insert(rows as never);
  if (error) return error.code === "23505" ? "duplicate_number" : error.message;
  return null;
}

async function syncCourts(
  supabase: AnySupabase,
  venueId: string,
  courts: UserVenueCourt[],
): Promise<string | null> {
  const { data: existing } = (await supabase
    .from("courts")
    .select("id")
    .eq("venue_id", venueId)) as { data: Array<{ id: string }> | null };
  const existingIds = new Set((existing ?? []).map((c) => c.id));
  const incomingIds = new Set(courts.map((c) => c.id).filter((x): x is string => Boolean(x)));

  const toDelete = Array.from(existingIds).filter((id) => !incomingIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("courts")
      .delete()
      .in("id", toDelete)
      .eq("venue_id", venueId);
    if (error) return error.message;
  }

  for (const c of courts) {
    if (c.id && existingIds.has(c.id)) {
      const { error } = await supabase
        .from("courts")
        .update({
          number: c.number,
          name: c.name,
          surface: c.surface ?? null,
          is_indoor: c.is_indoor,
        } as never)
        .eq("id", c.id)
        .eq("venue_id", venueId);
      if (error) return error.code === "23505" ? "duplicate_number" : error.message;
    } else {
      const insertError = await insertCourts(supabase, venueId, [c]);
      if (insertError) return insertError;
    }
  }
  return null;
}
