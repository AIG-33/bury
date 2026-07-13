"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Settings screen actions: notification channel toggles map 1:1 to the
// `profiles.notification_*` boolean columns (same fields the full profile
// form edits — the mobile screen is just a faster switch).
// =============================================================================

const ToggleSchema = z.object({
  channel: z.enum(["email", "telegram", "whatsapp"]),
  enabled: z.boolean(),
});

const COLUMN: Record<z.infer<typeof ToggleSchema>["channel"], string> = {
  email: "notification_email",
  telegram: "notification_telegram",
  whatsapp: "notification_whatsapp",
};

export type ToggleResult = { ok: true } | { ok: false; error: string };

export async function updateNotificationChannel(input: unknown): Promise<ToggleResult> {
  const parsed = ToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ [COLUMN[parsed.data.channel]]: parsed.data.enabled } as never)
    .eq("id", user.id);

  if (error) return { ok: false, error: "db_error" };

  revalidatePath("/m/settings");
  return { ok: true };
}
