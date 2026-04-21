"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CoachProfileFormSchema,
  type CoachProfileForm,
} from "@/lib/profile/coach-schema";

export type CoachProfileSnapshot = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  coach_bio: string | null;
  coach_hourly_rate_pln: number | null;
  coach_lat: number | null;
  coach_lng: number | null;
  coach_show_on_map: boolean;
  coach_avg_rating: number | null;
  coach_reviews_count: number;
};

export type LoadCoachProfileResult =
  | { ok: true; profile: CoachProfileSnapshot }
  | { ok: false; error: "not_authenticated" | "not_a_coach" | "not_found" };

export async function loadMyCoachProfile(): Promise<LoadCoachProfileResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: row } = (await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, city, is_coach, " +
        "coach_bio, coach_hourly_rate_pln, coach_lat, coach_lng, " +
        "coach_show_on_map, coach_avg_rating, coach_reviews_count",
    )
    .eq("id", user.id)
    .maybeSingle()) as {
    data: (CoachProfileSnapshot & { is_coach: boolean }) | null;
  };

  if (!row) return { ok: false, error: "not_found" };
  if (!row.is_coach) return { ok: false, error: "not_a_coach" };

  return {
    ok: true,
    profile: {
      id: row.id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      city: row.city,
      coach_bio: row.coach_bio ?? null,
      coach_hourly_rate_pln: row.coach_hourly_rate_pln ?? null,
      coach_lat: row.coach_lat ?? null,
      coach_lng: row.coach_lng ?? null,
      coach_show_on_map: row.coach_show_on_map ?? true,
      coach_avg_rating: row.coach_avg_rating ?? null,
      coach_reviews_count: row.coach_reviews_count ?? 0,
    },
  };
}

export type SaveCoachProfileResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

export async function saveMyCoachProfile(
  input: unknown,
): Promise<SaveCoachProfileResult> {
  const parsed = CoachProfileFormSchema.safeParse(input);
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

  const v: CoachProfileForm = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      coach_bio: v.coach_bio,
      coach_hourly_rate_pln: v.coach_hourly_rate_pln,
      coach_lat: v.coach_lat,
      coach_lng: v.coach_lng,
      coach_show_on_map: v.coach_show_on_map,
    } as never)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/coach/profile");
  revalidatePath("/coaches");
  revalidatePath(`/coaches/${user.id}`);
  revalidatePath("/coaches/map");
  return { ok: true };
}
