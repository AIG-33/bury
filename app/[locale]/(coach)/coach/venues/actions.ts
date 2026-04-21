"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  VenueFormSchema,
  CourtFormSchema,
  type VenueAmenity,
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
  district_id: string | null;
  district_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  is_indoor: boolean;
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
};

export type DistrictOption = { id: string; name: string };

// =============================================================================
// Auth helper — guarantees we have a coach.
// =============================================================================

async function requireCoach() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };

  const { data: profile } = (await supabase
    .from("profiles")
    .select("id, is_coach, is_admin")
    .eq("id", user.id)
    .single()) as { data: { id: string; is_coach: boolean; is_admin: boolean } | null };

  if (!profile) return { ok: false as const, error: "no_profile" as const };
  if (!profile.is_coach && !profile.is_admin) {
    return { ok: false as const, error: "not_a_coach" as const };
  }
  return { ok: true as const, supabase, userId: profile.id };
}

// =============================================================================
// Load venues for the current coach + district options.
// =============================================================================

export async function loadCoachVenues(): Promise<
  | { ok: true; venues: VenueRow[]; districts: DistrictOption[] }
  | { ok: false; error: "not_authenticated" | "no_profile" | "not_a_coach" }
> {
  const auth = await requireCoach();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: venues } = (await supabase
    .from("venues")
    .select(
      "id, name, city, district_id, address, lat, lng, is_indoor, amenities, created_at, updated_at",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })) as {
    data: Array<Omit<VenueRow, "courts_count" | "district_name">> | null;
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

  const districtIds = Array.from(
    new Set(
      (venues ?? [])
        .map((v) => v.district_id)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const districtMap = new Map<string, string>();
  if (districtIds.length > 0) {
    const { data: ds } = (await supabase
      .from("districts")
      .select("id, name")
      .in("id", districtIds)) as { data: Array<{ id: string; name: string }> | null };
    for (const d of ds ?? []) districtMap.set(d.id, d.name);
  }

  const enriched: VenueRow[] = (venues ?? []).map((v) => ({
    ...v,
    amenities: (v.amenities ?? []) as VenueAmenity[],
    courts_count: courtsCounts.get(v.id) ?? 0,
    district_name: v.district_id ? (districtMap.get(v.district_id) ?? null) : null,
  }));

  const { data: allDistricts } = (await supabase
    .from("districts")
    .select("id, name, city")
    .eq("country", "PL")
    .order("city", { ascending: true })) as {
    data: Array<{ id: string; name: string; city: string }> | null;
  };
  const districts: DistrictOption[] = (allDistricts ?? []).map((d) => ({
    id: d.id,
    name: `${d.city} · ${d.name}`,
  }));

  return { ok: true, venues: enriched, districts };
}

// =============================================================================
// Load a single venue with its courts.
// =============================================================================

export async function loadVenueDetail(venueId: string): Promise<
  | {
      ok: true;
      venue: VenueRow;
      courts: CourtRow[];
      districts: DistrictOption[];
    }
  | {
      ok: false;
      error: "not_authenticated" | "no_profile" | "not_a_coach" | "not_found";
    }
> {
  const auth = await requireCoach();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: row } = (await supabase
    .from("venues")
    .select(
      "id, name, city, district_id, address, lat, lng, is_indoor, amenities, created_at, updated_at",
    )
    .eq("id", venueId)
    .eq("owner_id", userId)
    .single()) as {
    data: Omit<VenueRow, "courts_count" | "district_name"> | null;
  };
  if (!row) return { ok: false, error: "not_found" };

  const { data: courts } = (await supabase
    .from("courts")
    .select("id, venue_id, number, name, surface, status")
    .eq("venue_id", venueId)
    .order("number", { ascending: true })) as { data: CourtRow[] | null };

  let districtName: string | null = null;
  if (row.district_id) {
    const { data: d } = (await supabase
      .from("districts")
      .select("name")
      .eq("id", row.district_id)
      .single()) as { data: { name: string } | null };
    districtName = d?.name ?? null;
  }

  const { data: allDistricts } = (await supabase
    .from("districts")
    .select("id, name, city")
    .eq("country", "PL")
    .order("city", { ascending: true })) as {
    data: Array<{ id: string; name: string; city: string }> | null;
  };
  const districts: DistrictOption[] = (allDistricts ?? []).map((d) => ({
    id: d.id,
    name: `${d.city} · ${d.name}`,
  }));

  return {
    ok: true,
    venue: {
      ...row,
      amenities: (row.amenities ?? []) as VenueAmenity[],
      courts_count: (courts ?? []).length,
      district_name: districtName,
    },
    courts: courts ?? [],
    districts,
  };
}

// =============================================================================
// Mutations
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

  const auth = await requireCoach();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const v = parsed.data;
  const { data, error } = (await supabase
    .from("venues")
    .insert({
      owner_id: userId,
      name: v.name,
      city: v.city,
      district_id: v.district_id ?? null,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      is_indoor: v.is_indoor,
      amenities: v.amenities,
    } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: error?.message ?? "db_error" };

  revalidatePath("/coach/venues");
  return { ok: true, id: data.id };
}

const UpdateVenueInput = z
  .object({ id: z.string().uuid() })
  .and(VenueFormSchema);

export async function updateVenue(input: unknown): Promise<SaveResult> {
  const parsed = UpdateVenueInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const auth = await requireCoach();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { id, ...v } = parsed.data;
  const { error } = await supabase
    .from("venues")
    .update({
      name: v.name,
      city: v.city,
      district_id: v.district_id ?? null,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      is_indoor: v.is_indoor,
      amenities: v.amenities,
    } as never)
    .eq("id", id)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/coach/venues");
  revalidatePath(`/coach/venues/${id}`);
  return { ok: true, id };
}

export async function deleteVenue(
  venueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(venueId).success) {
    return { ok: false, error: "invalid_id" };
  }
  const auth = await requireCoach();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { error } = await supabase
    .from("venues")
    .delete()
    .eq("id", venueId)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/coach/venues");
  return { ok: true };
}

// ─── Courts ──────────────────────────────────────────────────────────────────

const CreateCourtInput = z
  .object({ venue_id: z.string().uuid() })
  .and(CourtFormSchema);

export async function createCourt(input: unknown): Promise<SaveResult> {
  const parsed = CreateCourtInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const auth = await requireCoach();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { venue_id, ...c } = parsed.data;

  // Verify ownership of the venue (defense-in-depth on top of RLS).
  const { data: v } = (await supabase
    .from("venues")
    .select("id")
    .eq("id", venue_id)
    .eq("owner_id", userId)
    .single()) as { data: { id: string } | null };
  if (!v) return { ok: false, error: "not_authorized" };

  const { data, error } = (await supabase
    .from("courts")
    .insert({
      venue_id,
      number: c.number,
      name: c.name,
      surface: c.surface ?? null,
      status: c.status,
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

  revalidatePath(`/coach/venues/${venue_id}`);
  revalidatePath("/coach/venues");
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
  const auth = await requireCoach();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  const { id, venue_id, ...c } = parsed.data;

  const { data: v } = (await supabase
    .from("venues")
    .select("id")
    .eq("id", venue_id)
    .eq("owner_id", userId)
    .single()) as { data: { id: string } | null };
  if (!v) return { ok: false, error: "not_authorized" };

  const { error } = (await supabase
    .from("courts")
    .update({
      number: c.number,
      name: c.name,
      surface: c.surface ?? null,
      status: c.status,
    } as never)
    .eq("id", id)
    .eq("venue_id", venue_id)) as { error: { code?: string; message: string } | null };

  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate_number" };
    return { ok: false, error: error.message };
  }

  revalidatePath(`/coach/venues/${venue_id}`);
  return { ok: true, id };
}

export async function deleteCourt(
  courtId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(courtId).success) {
    return { ok: false, error: "invalid_id" };
  }
  const auth = await requireCoach();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, userId } = auth;

  // RLS already restricts, but we still resolve venue_id for revalidation.
  const { data: court } = (await supabase
    .from("courts")
    .select("venue_id, venues!inner(owner_id)")
    .eq("id", courtId)
    .single()) as {
    data:
      | { venue_id: string; venues: { owner_id: string } | { owner_id: string }[] }
      | null;
  };
  if (!court) return { ok: false, error: "not_found" };
  const owner = Array.isArray(court.venues) ? court.venues[0]?.owner_id : court.venues.owner_id;
  if (owner !== userId) return { ok: false, error: "not_authorized" };

  const { error } = await supabase.from("courts").delete().eq("id", courtId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/venues/${court.venue_id}`);
  revalidatePath("/coach/venues");
  return { ok: true };
}
