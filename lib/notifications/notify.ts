/**
 * Preference-aware notification fan-out.
 *
 * One call = one event for one recipient. It always creates the in-app feed
 * row (email channel; `cancelled` when the user opted out of e-mail so the
 * cron skips delivery but /m/notifications still shows it), and additionally
 * queues a Telegram copy when the user enabled the Telegram channel.
 * The Telegram row is silently dropped by the drain worker if the user never
 * linked the bot.
 *
 * MUST be called with the service-role client: it reads the recipient's
 * profile and writes outbox rows on their behalf.
 */

import { enqueue } from "./outbox";
import type { Locale, Payload, TemplateCode } from "./templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type NotifyInput = {
  recipientId: string;
  template: TemplateCode;
  payload: Payload;
  /** Locale-less in-app path for the feed row (e.g. /tournaments/<id>). */
  linkUrl?: string | null;
  scheduledAt?: string;
};

export async function notifyUser(service: AnySupabase, input: NotifyInput): Promise<void> {
  try {
    const { data: prof } = (await service
      .from("profiles")
      .select("locale, notification_email, notification_telegram")
      .eq("id", input.recipientId)
      .maybeSingle()) as {
      data: {
        locale: string | null;
        notification_email: boolean;
        notification_telegram: boolean;
      } | null;
    };
    if (!prof) return;
    const locale: Locale = prof.locale === "en" ? "en" : "ru";

    await enqueue(service, {
      recipient_id: input.recipientId,
      channel: "email",
      template: input.template,
      locale,
      payload: input.payload,
      link_url: input.linkUrl ?? null,
      scheduled_at: input.scheduledAt,
      status: prof.notification_email ? "pending" : "cancelled",
    });

    if (prof.notification_telegram) {
      await enqueue(service, {
        recipient_id: input.recipientId,
        channel: "telegram",
        template: input.template,
        locale,
        payload: input.payload,
        link_url: input.linkUrl ?? null,
        scheduled_at: input.scheduledAt,
      });
    }
  } catch (e) {
    console.warn(`[notify] failed to enqueue ${input.template} for ${input.recipientId}:`, e);
  }
}
