"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  CoachApplicationFormSchema,
  COACH_APPLICATION_LIMITS,
  type CoachApplicationAttachment,
  type CoachApplicationStatus,
} from "@/lib/coach-applications/schema";

// =============================================================================
// Types
// =============================================================================

export type MyCoachApplication = {
  id: string;
  status: CoachApplicationStatus;
  message: string;
  attachments: CoachApplicationAttachment[];
  admin_comment: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LoadMyApplicationsResult =
  | {
      ok: true;
      is_already_coach: boolean;
      // Most recent first; page renders the head as "current state".
      applications: MyCoachApplication[];
    }
  | { ok: false; error: "not_authenticated" };

// =============================================================================
// Load
// =============================================================================

export async function loadMyCoachApplications(): Promise<LoadMyApplicationsResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_coach")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_coach: boolean } | null };

  const { data: rows } = (await supabase
    .from("coach_applications")
    .select(
      "id, status, message, attachments, admin_comment, decided_at, created_at, updated_at",
    )
    .eq("player_id", user.id)
    .order("created_at", { ascending: false })) as {
    data: Array<{
      id: string;
      status: CoachApplicationStatus;
      message: string;
      attachments: unknown;
      admin_comment: string | null;
      decided_at: string | null;
      created_at: string;
      updated_at: string;
    }> | null;
  };

  const applications: MyCoachApplication[] = (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    message: r.message,
    attachments: Array.isArray(r.attachments)
      ? (r.attachments as CoachApplicationAttachment[])
      : [],
    admin_comment: r.admin_comment,
    decided_at: r.decided_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return {
    ok: true,
    is_already_coach: Boolean(profile?.is_coach),
    applications,
  };
}

// =============================================================================
// Submit
//
// Receives FormData: message + 0..N files (field name "files").
// Persists files to the private `coach-applications` bucket and creates the
// application row in a single shot.
// =============================================================================

export type SubmitResult =
  | { ok: true; application_id: string }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "already_coach"
        | "pending_exists"
        | "invalid_payload"
        | "file_too_large"
        | "bad_mime"
        | "too_many_files"
        | "upload_failed"
        | "db_error";
      detail?: string;
      fieldErrors?: Record<string, string[]>;
    };

const ALLOWED_MIME = COACH_APPLICATION_LIMITS.allowed_mime_types as readonly string[];

export async function submitCoachApplication(
  formData: FormData,
): Promise<SubmitResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_coach")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_coach: boolean } | null };
  if (profile?.is_coach) return { ok: false, error: "already_coach" };

  // Block double-submission while pending — DB has the same constraint
  // but we want a friendly error before we start uploading bytes.
  const { data: existing } = (await supabase
    .from("coach_applications")
    .select("id")
    .eq("player_id", user.id)
    .eq("status", "pending")
    .maybeSingle()) as { data: { id: string } | null };
  if (existing) return { ok: false, error: "pending_exists" };

  const message = String(formData.get("message") ?? "");
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length > COACH_APPLICATION_LIMITS.attachments_max)
    return { ok: false, error: "too_many_files" };
  for (const f of files) {
    if (f.size > COACH_APPLICATION_LIMITS.file_max_bytes)
      return { ok: false, error: "file_too_large", detail: f.name };
    if (!ALLOWED_MIME.includes(f.type))
      return { ok: false, error: "bad_mime", detail: `${f.name} (${f.type})` };
  }

  // Validate the message via schema (attachments validated below after upload).
  const parsed = CoachApplicationFormSchema.safeParse({
    message,
    attachments: [],
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const service = createSupabaseServiceClient();

  // Create the row first so we have an id to scope storage paths under.
  const { data: created, error: insErr } = (await service
    .from("coach_applications")
    .insert({
      player_id: user.id,
      message: parsed.data.message,
      attachments: [],
    } as never)
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (insErr || !created) {
    return { ok: false, error: "db_error", detail: insErr?.message };
  }

  const application_id = created.id;
  const uploaded: CoachApplicationAttachment[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 200);
    const path = `${user.id}/${application_id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await service.storage
      .from("coach-applications")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      // Rollback: nuke uploaded files + the application row to keep state clean.
      if (uploaded.length > 0) {
        await service.storage
          .from("coach-applications")
          .remove(uploaded.map((u) => u.path));
      }
      await service.from("coach_applications").delete().eq("id", application_id);
      return { ok: false, error: "upload_failed", detail: upErr.message };
    }
    uploaded.push({
      path,
      name: file.name,
      size: file.size,
      mime_type: file.type,
    });
  }

  if (uploaded.length > 0) {
    const { error: updErr } = await service
      .from("coach_applications")
      .update({ attachments: uploaded } as never)
      .eq("id", application_id);
    if (updErr) {
      return { ok: false, error: "db_error", detail: updErr.message };
    }
  }

  revalidatePath("/me/become-coach");
  revalidatePath("/me/profile");
  return { ok: true, application_id };
}
