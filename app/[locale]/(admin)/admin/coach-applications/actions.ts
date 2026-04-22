"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  CoachApplicationDecisionSchema,
  type CoachApplicationAttachment,
  type CoachApplicationStatus,
} from "@/lib/coach-applications/schema";

// =============================================================================
// Types
// =============================================================================

export type AdminCoachApplicationRow = {
  id: string;
  status: CoachApplicationStatus;
  message: string;
  attachments: CoachApplicationAttachment[];
  admin_comment: string | null;
  decided_at: string | null;
  decided_by_name: string | null;
  created_at: string;
  updated_at: string;
  player: {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    is_coach: boolean;
  };
};

export type AdminAttachmentSignedUrl = {
  path: string;
  url: string;
};

export type LoadAdminAppsFilter = "pending" | "decided" | "all";

export type LoadAdminApplicationsResult =
  | { ok: true; rows: AdminCoachApplicationRow[] }
  | { ok: false; error: "not_authenticated" | "not_an_admin" };

// =============================================================================
// Load list
// =============================================================================

export async function loadAdminCoachApplications(
  filter: LoadAdminAppsFilter,
): Promise<LoadAdminApplicationsResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: me } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!me?.is_admin) return { ok: false, error: "not_an_admin" };

  // Use the service client so we can join `profiles` (RLS protects it but
  // admins are allowed); going through service is consistent with our other
  // admin loaders and avoids RLS edge cases.
  const service = createSupabaseServiceClient();

  let query = service
    .from("coach_applications")
    .select(
      "id, status, message, attachments, admin_comment, decided_at, decided_by, created_at, updated_at, player_id",
    )
    .order("created_at", { ascending: false });

  if (filter === "pending") query = query.eq("status", "pending");
  if (filter === "decided") query = query.in("status", ["approved", "rejected"]);

  const { data: apps } = (await query) as {
    data: Array<{
      id: string;
      status: CoachApplicationStatus;
      message: string;
      attachments: unknown;
      admin_comment: string | null;
      decided_at: string | null;
      decided_by: string | null;
      created_at: string;
      updated_at: string;
      player_id: string;
    }> | null;
  };

  if (!apps || apps.length === 0) return { ok: true, rows: [] };

  const playerIds = Array.from(new Set(apps.map((a) => a.player_id)));
  const adminIds = Array.from(
    new Set(apps.map((a) => a.decided_by).filter(Boolean) as string[]),
  );
  const allProfileIds = Array.from(new Set([...playerIds, ...adminIds]));

  const { data: profiles } = (await service
    .from("profiles")
    .select("id, display_name, email, avatar_url, is_coach")
    .in("id", allProfileIds)) as {
    data: Array<{
      id: string;
      display_name: string | null;
      email: string | null;
      avatar_url: string | null;
      is_coach: boolean;
    }> | null;
  };

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p] as const),
  );

  const rows: AdminCoachApplicationRow[] = apps.map((a) => {
    const player = profileById.get(a.player_id);
    const decidedBy = a.decided_by ? profileById.get(a.decided_by) : null;
    return {
      id: a.id,
      status: a.status,
      message: a.message,
      attachments: Array.isArray(a.attachments)
        ? (a.attachments as CoachApplicationAttachment[])
        : [],
      admin_comment: a.admin_comment,
      decided_at: a.decided_at,
      decided_by_name: decidedBy?.display_name ?? decidedBy?.email ?? null,
      created_at: a.created_at,
      updated_at: a.updated_at,
      player: {
        id: a.player_id,
        display_name: player?.display_name ?? null,
        email: player?.email ?? null,
        avatar_url: player?.avatar_url ?? null,
        is_coach: Boolean(player?.is_coach),
      },
    };
  });

  return { ok: true, rows };
}

// =============================================================================
// Get signed URLs for an application's attachments (admin only).
// =============================================================================

export async function getApplicationAttachmentUrls(
  application_id: string,
): Promise<
  | { ok: true; urls: AdminAttachmentSignedUrl[] }
  | { ok: false; error: "not_authenticated" | "not_an_admin" | "not_found" | "storage_error"; detail?: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: me } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!me?.is_admin) return { ok: false, error: "not_an_admin" };

  const service = createSupabaseServiceClient();
  const { data: app } = (await service
    .from("coach_applications")
    .select("attachments")
    .eq("id", application_id)
    .maybeSingle()) as { data: { attachments: unknown } | null };
  if (!app) return { ok: false, error: "not_found" };

  const attachments = (Array.isArray(app.attachments)
    ? (app.attachments as CoachApplicationAttachment[])
    : []) as CoachApplicationAttachment[];

  const urls: AdminAttachmentSignedUrl[] = [];
  for (const a of attachments) {
    const { data, error } = await service.storage
      .from("coach-applications")
      .createSignedUrl(a.path, 60 * 10); // 10 minutes is enough to open
    if (error || !data) {
      return { ok: false, error: "storage_error", detail: error?.message };
    }
    urls.push({ path: a.path, url: data.signedUrl });
  }

  return { ok: true, urls };
}

// =============================================================================
// Decide (approve / reject)
// =============================================================================

export type DecideResult =
  | { ok: true; new_status: "approved" | "rejected" }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "not_an_admin"
        | "not_found"
        | "not_pending"
        | "invalid_payload"
        | "db_error";
      detail?: string;
      fieldErrors?: Record<string, string[]>;
    };

export async function decideCoachApplication(
  input: unknown,
): Promise<DecideResult> {
  const parsed = CoachApplicationDecisionSchema.safeParse(input);
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

  const { data: me } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!me?.is_admin) return { ok: false, error: "not_an_admin" };

  const service = createSupabaseServiceClient();

  // Load the application — must still be pending.
  const { data: app } = (await service
    .from("coach_applications")
    .select("id, player_id, status")
    .eq("id", parsed.data.application_id)
    .maybeSingle()) as {
    data: { id: string; player_id: string; status: CoachApplicationStatus } | null;
  };
  if (!app) return { ok: false, error: "not_found" };
  if (app.status !== "pending") return { ok: false, error: "not_pending" };

  // Update the application row first.
  const { error: updErr } = await service
    .from("coach_applications")
    .update({
      status: parsed.data.decision,
      admin_comment: parsed.data.admin_comment,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    } as never)
    .eq("id", app.id);
  if (updErr) return { ok: false, error: "db_error", detail: updErr.message };

  // On approval, flip the player's `is_coach` flag.
  if (parsed.data.decision === "approved") {
    const { error: profErr } = await service
      .from("profiles")
      .update({ is_coach: true } as never)
      .eq("id", app.player_id);
    if (profErr) return { ok: false, error: "db_error", detail: profErr.message };
  }

  revalidatePath("/admin/coach-applications");
  revalidatePath("/me/become-coach");
  revalidatePath("/me/profile");
  return { ok: true, new_status: parsed.data.decision };
}
