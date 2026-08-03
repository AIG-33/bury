"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  VenueFormSchema,
  CourtFormSchema,
  type VenueAmenity,
  type VenueIndoorStatus,
  type CourtSurface,
  type CourtStatus,
} from "@/lib/venues/schema";

// =============================================================================
// Types returned to UI
// =============================================================================

export type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  country: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  indoor_status: VenueIndoorStatus;
  amenities: VenueAmenity[];
  courts_count: number;
  created_at: string;
  updated_at: string;
};

export type CourtRow = {
  id: string;
  venue_id: string;
  number: number;
  name: string | null;
  surface: CourtSurface | null;
  status: CourtStatus;
  is_indoor: boolean;
};

// =============================================================================
// Auth helper — admin-only. Venues are an admin-curated directory; coaches
// and players just SELECT from it via the public read policy.
// =============================================================================

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };

  const { data: profile } = (await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .single()) as { data: { id: string; is_admin: boolean } | null };

  if (!profile) return { ok: false as const, error: "no_profile" as const };
  if (!profile.is_admin) {
    return { ok: false as const, error: "not_an_admin" as const };
  }
  return { ok: true as const, supabase };
}

// =============================================================================
// Load venues directory.
// =============================================================================

export async function loadAdminVenues(): Promise<
  | { ok: true; venues: VenueRow[] }
  | { ok: false; error: "not_authenticated" | "no_profile" | "not_an_admin" }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const { data: venues } = (await supabase
    .from("venues")
    .select(
      "id, name, city, country, address, lat, lng, indoor_status, amenities, created_at, updated_at",
    )
    .order("created_at", { ascending: false })) as {
    data: Array<Omit<VenueRow, "courts_count">> | null;
  };

  const ids = (venues ?? []).map((v) => v.id);
  const courtsCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: cnt } = (await supabase
      .from("courts")
      .select("venue_id")
      .in("venue_id", ids)) as { data: Array<{ venue_id: string }> | null };
    for (const c of cnt ?? []) {
      courtsCounts.set(c.venue_id, (courtsCounts.get(c.venue_id) ?? 0) + 1);
    }
  }

  const enriched: VenueRow[] = (venues ?? []).map((v) => ({
    ...v,
    amenities: (v.amenities ?? []) as VenueAmenity[],
    courts_count: courtsCounts.get(v.id) ?? 0,
  }));

  return { ok: true, venues: enriched };
}

// =============================================================================
// Load a single venue with its courts.
// =============================================================================

export async function loadVenueDetail(venueId: string): Promise<
  | {
      ok: true;
      venue: VenueRow;
      courts: CourtRow[];
    }
  | {
      ok: false;
      error: "not_authenticated" | "no_profile" | "not_an_admin" | "not_found";
    }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const { data: row } = (await supabase
    .from("venues")
    .select(
      "id, name, city, country, address, lat, lng, indoor_status, amenities, created_at, updated_at",
    )
    .eq("id", venueId)
    .single()) as {
    data: Omit<VenueRow, "courts_count"> | null;
  };
  if (!row) return { ok: false, error: "not_found" };

  const { data: courts } = (await supabase
    .from("courts")
    .select("id, venue_id, number, name, surface, status, is_indoor")
    .eq("venue_id", venueId)
    .order("number", { ascending: true })) as { data: CourtRow[] | null };

  return {
    ok: true,
    venue: {
      ...row,
      amenities: (row.amenities ?? []) as VenueAmenity[],
      courts_count: (courts ?? []).length,
    },
    courts: courts ?? [],
  };
}

// =============================================================================
// Mutations — all admin-only
// =============================================================================

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createVenue(input: unknown): Promise<SaveResult> {
  const parsed = VenueFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const v = parsed.data;
  const { data, error } = (await supabase
    .from("venues")
    .insert({
      name: v.name,
      city: v.city,
      country: v.country,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      amenities: v.amenities,
    } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: error?.message ?? "db_error" };

  revalidatePath("/admin/venues");
  return { ok: true, id: data.id };
}

const UpdateVenueInput = z.object({ id: z.string().uuid() }).and(VenueFormSchema);

export async function updateVenue(input: unknown): Promise<SaveResult> {
  const parsed = UpdateVenueInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { id, ...v } = parsed.data;
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
    } as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/venues");
  revalidatePath(`/admin/venues/${id}`);
  return { ok: true, id };
}

export async function deleteVenue(
  venueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(venueId).success) {
    return { ok: false, error: "invalid_id" };
  }
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase.from("venues").delete().eq("id", venueId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/venues");
  return { ok: true };
}

// ─── Courts ──────────────────────────────────────────────────────────────────

const CreateCourtInput = z.object({ venue_id: z.string().uuid() }).and(CourtFormSchema);

export async function createCourt(input: unknown): Promise<SaveResult> {
  const parsed = CreateCourtInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { venue_id, ...c } = parsed.data;

  // Verify venue exists (defense-in-depth on top of RLS).
  const { data: v } = (await supabase.from("venues").select("id").eq("id", venue_id).single()) as {
    data: { id: string } | null;
  };
  if (!v) return { ok: false, error: "venue_not_found" };

  const { data, error } = (await supabase
    .from("courts")
    .insert({
      venue_id,
      number: c.number,
      name: c.name,
      surface: c.surface ?? null,
      status: c.status,
      is_indoor: c.is_indoor,
    } as never)
    .select("id")
    .single()) as {
    data: { id: string } | null;
    error: { code?: string; message: string } | null;
  };

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "duplicate_number" };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "db_error" };

  revalidatePath(`/admin/venues/${venue_id}`);
  revalidatePath("/admin/venues");
  return { ok: true, id: data.id };
}

const UpdateCourtInput = z
  .object({ id: z.string().uuid(), venue_id: z.string().uuid() })
  .and(CourtFormSchema);

export async function updateCourt(input: unknown): Promise<SaveResult> {
  const parsed = UpdateCourtInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { id, venue_id, ...c } = parsed.data;

  const { error } = (await supabase
    .from("courts")
    .update({
      number: c.number,
      name: c.name,
      surface: c.surface ?? null,
      status: c.status,
      is_indoor: c.is_indoor,
    } as never)
    .eq("id", id)
    .eq("venue_id", venue_id)) as { error: { code?: string; message: string } | null };

  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate_number" };
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/venues/${venue_id}`);
  return { ok: true, id };
}

export async function deleteCourt(
  courtId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(courtId).success) {
    return { ok: false, error: "invalid_id" };
  }
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  // Resolve venue_id for revalidation.
  const { data: court } = (await supabase
    .from("courts")
    .select("venue_id")
    .eq("id", courtId)
    .single()) as { data: { venue_id: string } | null };
  if (!court) return { ok: false, error: "not_found" };

  const { error } = await supabase.from("courts").delete().eq("id", courtId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/venues/${court.venue_id}`);
  revalidatePath("/admin/venues");
  return { ok: true };
}
