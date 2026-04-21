/**
 * Outbox helpers — the only sanctioned way to deliver notifications.
 *
 * Flow:
 *   enqueue(...)  → INSERT into notifications_outbox
 *   drainOutbox() → cron worker pulls due rows, sends, marks status
 *
 * Why an outbox (vs sending inline in server actions):
 *  - Idempotent retries on transient SMTP/Resend errors.
 *  - Respect per-user channel preferences (email/telegram/whatsapp).
 *  - Audit trail of every outbound message.
 *  - Future-proof for WhatsApp Business API + Telegram bot.
 */

import { renderTemplate, type Locale, type Payload, type TemplateCode } from "./templates";
import { sendEmail } from "@/lib/email/send";

// Loose Supabase shape so we can accept either server or service client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type OutboxChannel = "email" | "telegram";

export type EnqueueInput = {
  recipient_id: string;
  channel: OutboxChannel;
  template: TemplateCode;
  locale: Locale;
  payload: Payload;
  scheduled_at?: string;
};

export type EnqueueResult = { ok: true; id: string } | { ok: false; error: string };

export async function enqueue(
  supabase: AnySupabase,
  input: EnqueueInput,
): Promise<EnqueueResult> {
  const { data, error } = await supabase
    .from("notifications_outbox")
    .insert({
      recipient_id: input.recipient_id,
      channel: input.channel,
      template: input.template,
      locale: input.locale,
      payload: input.payload as Record<string, unknown>,
      scheduled_at: input.scheduled_at ?? new Date().toISOString(),
      status: "pending",
    } as never)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "no_data" };
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Best-effort enqueue (multiple notifications in a single call).
 * Errors are swallowed: notifications must never block the primary action.
 */
export async function enqueueMany(
  supabase: AnySupabase,
  inputs: EnqueueInput[],
): Promise<{ enqueued: number; failed: number }> {
  let enq = 0;
  let fail = 0;
  for (const input of inputs) {
    const r = await enqueue(supabase, input);
    if (r.ok) enq++;
    else fail++;
  }
  return { enqueued: enq, failed: fail };
}

// ---------------------------------------------------------------------------
// Drain: deliver due pending rows, mark sent/failed.
// ---------------------------------------------------------------------------

export type DrainStats = {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
};

export const MAX_ATTEMPTS = 5;

export async function drainOutbox(
  supabase: AnySupabase,
  opts: { limit?: number; nowIso?: string } = {},
): Promise<DrainStats> {
  const limit = opts.limit ?? 50;
  const now = opts.nowIso ?? new Date().toISOString();

  const { data: rows } = (await supabase
    .from("notifications_outbox")
    .select("id, recipient_id, channel, template, locale, payload, attempts")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_at", { ascending: true })
    .limit(limit)) as {
    data: Array<{
      id: string;
      recipient_id: string;
      channel: OutboxChannel;
      template: TemplateCode;
      locale: Locale;
      payload: Payload;
      attempts: number;
    }> | null;
  };

  const stats: DrainStats = { scanned: 0, sent: 0, failed: 0, skipped: 0 };
  for (const row of rows ?? []) {
    stats.scanned++;
    if (row.channel !== "email") {
      // Telegram channel intentionally a no-op until bot wired (Phase 2).
      stats.skipped++;
      await markStatus(supabase, row.id, "cancelled", row.attempts, "telegram_not_wired");
      continue;
    }
    const recipientEmail = await resolveEmail(supabase, row.recipient_id);
    if (!recipientEmail) {
      stats.failed++;
      await markStatus(supabase, row.id, "failed", row.attempts + 1, "no_email_for_recipient");
      continue;
    }
    const tpl = renderTemplate(row.template, row.locale, row.payload);
    const result = await sendEmail({
      to: recipientEmail,
      subject: tpl.subject,
      html: tpl.html,
    });
    if (result.ok) {
      stats.sent++;
      await markStatus(supabase, row.id, "sent", row.attempts + 1, null);
    } else {
      stats.failed++;
      await markStatus(supabase, row.id, "failed", row.attempts + 1, result.error);
    }
  }
  return stats;
}

async function markStatus(
  supabase: AnySupabase,
  id: string,
  status: "sent" | "failed" | "cancelled",
  attempts: number,
  lastError: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    attempts,
    last_error: lastError,
  };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  // failed rows that haven't hit MAX_ATTEMPTS go back to pending so cron retries.
  if (status === "failed" && attempts < MAX_ATTEMPTS) {
    patch.status = "pending";
    patch.scheduled_at = new Date(Date.now() + backoffMs(attempts)).toISOString();
  }
  await supabase.from("notifications_outbox").update(patch as never).eq("id", id);
}

export function backoffMs(attempts: number): number {
  // 1m, 5m, 15m, 60m, 4h
  const ladder = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 4 * 60 * 60_000];
  return ladder[Math.min(attempts - 1, ladder.length - 1)] ?? 60_000;
}

async function resolveEmail(supabase: AnySupabase, userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}
