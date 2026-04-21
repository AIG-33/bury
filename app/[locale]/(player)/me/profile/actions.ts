"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  ProfileFormSchema,
  type ProfileForm,
  EMPTY_AVAILABILITY,
  EMPTY_SOCIAL_LINKS,
  type Availability,
  type SocialLinks,
} from "@/lib/profile/schema";

// =============================================================================
// Types returned to UI (server → client safe)
// =============================================================================

export type ProfileSnapshot = ProfileForm & {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_elo: number;
  elo_status: "provisional" | "established";
  rated_matches_count: number;
  email: string | null;
};

export type DistrictOption = { id: string; name: string };

export type LoadResult =
  | { ok: true; profile: ProfileSnapshot; districts: DistrictOption[] }
  | { ok: false; error: "not_authenticated" | "profile_not_found" };

export async function loadMyProfile(): Promise<LoadResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: row } = (await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, current_elo, elo_status, rated_matches_count, " +
        "first_name, last_name, date_of_birth, gender, motto, favorite_player, " +
        "phone, whatsapp, telegram_username, social_links, city, district_id, " +
        "dominant_hand, backhand_style, favorite_surface, availability, " +
        "visible_in_find_player, visible_in_leaderboard, notification_email, " +
        "notification_whatsapp, notification_telegram, locale, health_notes, emergency_contact",
    )
    .eq("id", user.id)
    .single()) as { data: Record<string, unknown> | null };

  if (!row) return { ok: false, error: "profile_not_found" };

  const { data: districts } = (await supabase
    .from("districts")
    .select("id, name, city")
    .eq("country", "PL")
    .order("name", { ascending: true })) as {
    data: Array<{ id: string; name: string; city: string }> | null;
  };

  const locale = (row.locale as "pl" | "en" | "ru") ?? "pl";
  const districtOptions: DistrictOption[] = (districts ?? []).map((d) => ({
    id: d.id,
    name: `${d.city} · ${d.name}`,
  }));

  const profile: ProfileSnapshot = {
    id: row.id as string,
    display_name: (row.display_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    current_elo: (row.current_elo as number) ?? 1000,
    elo_status: ((row.elo_status as string) ?? "provisional") as
      | "provisional"
      | "established",
    rated_matches_count: (row.rated_matches_count as number) ?? 0,
    email: user.email ?? null,

    first_name: (row.first_name as string | null) ?? null,
    last_name: (row.last_name as string | null) ?? null,
    date_of_birth: (row.date_of_birth as string | null) ?? null,
    gender: (row.gender as ProfileForm["gender"]) ?? null,
    motto: (row.motto as string | null) ?? null,
    favorite_player: (row.favorite_player as string | null) ?? null,

    phone: (row.phone as string | null) ?? null,
    whatsapp: (row.whatsapp as string | null) ?? null,
    telegram_username: (row.telegram_username as string | null) ?? null,

    social_links: {
      ...EMPTY_SOCIAL_LINKS,
      ...((row.social_links as Partial<SocialLinks>) ?? {}),
    },

    city: (row.city as string | null) ?? null,
    district_id: (row.district_id as string | null) ?? null,

    dominant_hand: (row.dominant_hand as ProfileForm["dominant_hand"]) ?? null,
    backhand_style: (row.backhand_style as ProfileForm["backhand_style"]) ?? null,
    favorite_surface:
      (row.favorite_surface as ProfileForm["favorite_surface"]) ?? null,

    availability: {
      ...EMPTY_AVAILABILITY,
      ...((row.availability as Partial<Availability>) ?? {}),
    } as Availability,

    visible_in_find_player: (row.visible_in_find_player as boolean) ?? true,
    visible_in_leaderboard: (row.visible_in_leaderboard as boolean) ?? true,
    notification_email: (row.notification_email as boolean) ?? true,
    notification_whatsapp: (row.notification_whatsapp as boolean) ?? true,
    notification_telegram: (row.notification_telegram as boolean) ?? false,

    locale,
    health_notes: (row.health_notes as string | null) ?? null,
    emergency_contact: (row.emergency_contact as string | null) ?? null,
  };

  return { ok: true, profile, districts: districtOptions };
}

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateMyProfile(input: unknown): Promise<SaveResult> {
  const parsed = ProfileFormSchema.safeParse(input);
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

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: v.first_name,
      last_name: v.last_name,
      date_of_birth: v.date_of_birth,
      gender: v.gender ?? null,
      motto: v.motto,
      favorite_player: v.favorite_player,
      phone: v.phone,
      whatsapp: v.whatsapp,
      telegram_username: v.telegram_username,
      social_links: v.social_links,
      city: v.city,
      district_id: v.district_id,
      dominant_hand: v.dominant_hand ?? null,
      backhand_style: v.backhand_style ?? null,
      favorite_surface: v.favorite_surface ?? null,
      availability: v.availability,
      visible_in_find_player: v.visible_in_find_player,
      visible_in_leaderboard: v.visible_in_leaderboard,
      notification_email: v.notification_email,
      notification_whatsapp: v.notification_whatsapp,
      notification_telegram: v.notification_telegram,
      locale: v.locale,
      health_notes: v.health_notes,
      emergency_contact: v.emergency_contact,
    } as never)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

// =============================================================================
// Avatar upload — receives FormData (file + optional removeOnly flag).
// Stored at avatars/<user_id>/avatar-<timestamp>.<ext>; previous avatar removed.
// =============================================================================

export type AvatarResult =
  | { ok: true; avatar_url: string | null }
  | { ok: false; error: string };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadMyAvatar(formData: FormData): Promise<AvatarResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };
  if (file.size === 0) return { ok: false, error: "empty_file" };
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, error: "file_too_large" };
  if (!ALLOWED_MIME.includes(file.type)) return { ok: false, error: "bad_mime" };

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const service = createSupabaseServiceClient();
  const { error: upErr } = await service.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };

  const {
    data: { publicUrl },
  } = service.storage.from("avatars").getPublicUrl(path);

  // Best-effort cleanup of previous avatar files in the user folder.
  const { data: oldFiles } = await service.storage
    .from("avatars")
    .list(user.id);
  if (oldFiles && oldFiles.length > 0) {
    const newest = path.split("/")[1];
    const toRemove = oldFiles
      .map((f) => `${user.id}/${f.name}`)
      .filter((p) => p.split("/")[1] !== newest);
    if (toRemove.length > 0) {
      await service.storage.from("avatars").remove(toRemove);
    }
  }

  const { error: profErr } = await service
    .from("profiles")
    .update({ avatar_url: publicUrl } as never)
    .eq("id", user.id);
  if (profErr) return { ok: false, error: profErr.message };

  revalidatePath("/me/profile");
  revalidatePath("/", "layout");
  return { ok: true, avatar_url: publicUrl };
}

export async function removeMyAvatar(): Promise<AvatarResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const service = createSupabaseServiceClient();
  const { data: oldFiles } = await service.storage.from("avatars").list(user.id);
  if (oldFiles && oldFiles.length > 0) {
    await service.storage
      .from("avatars")
      .remove(oldFiles.map((f) => `${user.id}/${f.name}`));
  }

  const { error: profErr } = await service
    .from("profiles")
    .update({ avatar_url: null } as never)
    .eq("id", user.id);
  if (profErr) return { ok: false, error: profErr.message };

  revalidatePath("/me/profile");
  revalidatePath("/", "layout");
  return { ok: true, avatar_url: null };
}
