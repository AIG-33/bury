"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  createInvitationToken,
  INVITATION_TTL_DAYS,
} from "@/lib/invitations/token";
import { sendEmail } from "@/lib/email/send";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";

const InviteSchema = z.object({
  email: z.string().email(),
  first_name: z.string().trim().max(80).optional().or(z.literal("")),
  last_name: z.string().trim().max(80).optional().or(z.literal("")),
  locale: z.enum(["pl", "en", "ru"]).optional(),
});

export type InviteResult =
  | { ok: true; token: string; acceptUrl: string; emailMode: "resend" | "console" }
  | { ok: false; error: string };

export async function createInvitation(input: unknown): Promise<InviteResult> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: coach } = (await supabase
    .from("profiles")
    .select("is_coach, display_name, locale")
    .eq("id", user.id)
    .single()) as {
    data: { is_coach: boolean; display_name: string | null; locale: "pl" | "en" | "ru" } | null;
  };

  if (!coach?.is_coach) return { ok: false, error: "not_a_coach" };

  const { token, hash } = createInvitationToken();
  const expiresAt = addDays(new Date(), INVITATION_TTL_DAYS).toISOString();

  const service = createSupabaseServiceClient();
  const { error: insErr } = await service.from("invitations").insert({
    coach_id: user.id,
    email: parsed.data.email,
    first_name: parsed.data.first_name || null,
    last_name: parsed.data.last_name || null,
    token_hash: hash,
    expires_at: expiresAt,
    status: "pending",
  } as never);
  if (insErr) return { ok: false, error: insErr.message };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteLocale = parsed.data.locale ?? coach.locale ?? "pl";
  const acceptUrl = `${siteUrl}/${inviteLocale}/invite/${token}`;

  const { subject, html } = buildInvitationEmail({
    coachName: coach.display_name ?? "Your coach",
    acceptUrl,
    locale: inviteLocale,
  });

  const sent = await sendEmail({ to: parsed.data.email, subject, html });
  if (!sent.ok) return { ok: false, error: sent.error };

  revalidatePath("/coach/players");
  return { ok: true, token, acceptUrl, emailMode: sent.mode };
}
