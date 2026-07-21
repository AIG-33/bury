"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isValidConfirmationWord } from "./deletion";
import { performAccountDeletion } from "./perform-deletion";

// =============================================================================
// Full account deletion (App Store Guideline 5.1.1(v)).
//
// Flow: the signed-in user confirms by typing the confirmation word →
// this action runs the shared deletion core (lib/account/perform-deletion.ts,
// service role, bypasses RLS) for their own userId and signs the session out.
// The same core also powers admin-initiated deletion from /admin/db.
// =============================================================================

const DeleteAccountSchema = z.object({
  confirmation: z.string().min(1),
});

export type DeleteAccountResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_payload" | "wrong_confirmation" | "not_authenticated" | "db_error";
    }
  | {
      ok: false;
      error: "blocked";
      clubs: string[];
      tournaments: string[];
    };

export async function deleteAccount(input: unknown): Promise<DeleteAccountResult> {
  const parsed = DeleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  if (!isValidConfirmationWord(parsed.data.confirmation)) {
    return { ok: false, error: "wrong_confirmation" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const service = createSupabaseServiceClient();
  const result = await performAccountDeletion(service, user.id);
  if (!result.ok) return result;

  // The auth user is gone; clear the session cookies on this device.
  await supabase.auth.signOut();

  return { ok: true };
}
