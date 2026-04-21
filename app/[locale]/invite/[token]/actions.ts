"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hashInvitationToken } from "@/lib/invitations/token";

export type AcceptResult =
  | { ok: true; coachId: string }
  | { ok: false; error: "not_authenticated" | "invalid_or_expired" | "db_error" };

export async function acceptInvitationAction(token: string): Promise<AcceptResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const hash = hashInvitationToken(token);
  const service = createSupabaseServiceClient();

  // Manually replicate the SECURITY DEFINER fn so we can audit/log if needed.
  const { data: inv } = (await service
    .from("invitations")
    .select("id, coach_id, status, expires_at")
    .eq("token_hash", hash)
    .single()) as {
    data: { id: string; coach_id: string; status: string; expires_at: string } | null;
  };

  if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
    return { ok: false, error: "invalid_or_expired" };
  }

  const { error: updErr } = await service
    .from("invitations")
    .update({
      status: "accepted",
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    } as never)
    .eq("id", inv.id);

  if (updErr) return { ok: false, error: "db_error" };

  return { ok: true, coachId: inv.coach_id };
}
