/**
 * Telegram Bot webhook.
 *
 * What we handle (intentionally minimal):
 *   - `/start <token>` — verifies the HMAC, binds the chat to the user's
 *     profile via `telegram_links` (upsert by `player_id`), and posts a
 *     short confirmation back to the chat.
 *   - everything else — quick "what is this bot" reply, no DB writes.
 *
 * Security: Telegram lets you set a `secret_token` when registering the
 * webhook (`setWebhook?secret_token=...`). Telegram sends it back to us in
 * the `X-Telegram-Bot-Api-Secret-Token` header on every update. We compare
 * it to `TELEGRAM_WEBHOOK_SECRET` and reject on mismatch.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyTelegramLinkToken } from "@/lib/telegram/link-token";
import { sendTelegramMessage } from "@/lib/telegram/send";

export const runtime = "nodejs";

type TgMessage = {
  message_id: number;
  from?: { id: number; language_code?: string };
  chat: { id: number };
  text?: string;
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
};

const REPLIES = {
  ru: {
    linked:
      "🎾 Готово! PlayTennis.by теперь будет писать сюда об уведомлениях: новые предложения матчей и принятия. Изменить можно в профиле.",
    bad_token:
      "Не получилось привязать аккаунт. Открой ссылку «Подключить Telegram» в своём профиле PlayTennis.by ещё раз.",
    hello:
      "Привет! Это бот PlayTennis.by — он шлёт уведомления о матчах. Чтобы подключить, открой свой профиль на www.playtennis.by и нажми «Подключить Telegram».",
  },
  en: {
    linked:
      "🎾 Done! PlayTennis.by will now send notifications here — match proposals and acceptances. You can change this in your profile.",
    bad_token:
      "Couldn't link the account. Open the 'Connect Telegram' link in your PlayTennis.by profile again.",
    hello:
      "Hi! This is the PlayTennis.by bot — it sends match notifications. Open your profile on www.playtennis.by and click 'Connect Telegram' to link.",
  },
} as const;

function pickLocale(code?: string): "ru" | "en" {
  return code && code.startsWith("ru") ? "ru" : "en";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // Webhook accidentally hit without server-side wiring — pretend OK so
    // Telegram doesn't keep retrying.
    return NextResponse.json({ ok: true });
  }
  const incoming = req.headers.get("x-telegram-bot-api-secret-token");
  if (incoming !== secret) {
    return NextResponse.json({ ok: false, error: "bad_secret" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  if (!msg) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;
  const locale = pickLocale(msg.from?.language_code);

  const text = (msg.text ?? "").trim();
  if (text.startsWith("/start")) {
    const arg = text.slice("/start".length).trim();
    if (!arg) {
      await sendTelegramMessage({ chatId, text: REPLIES[locale].hello });
      return NextResponse.json({ ok: true });
    }
    const userId = verifyTelegramLinkToken(arg);
    if (!userId) {
      await sendTelegramMessage({ chatId, text: REPLIES[locale].bad_token });
      return NextResponse.json({ ok: true });
    }

    const service = createSupabaseServiceClient();
    // Upsert by player_id — re-linking overwrites the chat_id so a user can
    // switch Telegram accounts later without DB surgery.
    const { error } = await service
      .from("telegram_links")
      .upsert(
        { player_id: userId, chat_id: chatId, linked_at: new Date().toISOString() } as never,
        { onConflict: "player_id" } as never,
      );
    if (!error) {
      // Best-effort: flip notification_telegram on so they actually receive
      // updates without a second click.
      await service
        .from("profiles")
        .update({ notification_telegram: true } as never)
        .eq("id", userId);
    }
    await sendTelegramMessage({
      chatId,
      text: error ? REPLIES[locale].bad_token : REPLIES[locale].linked,
    });
    return NextResponse.json({ ok: true });
  }

  await sendTelegramMessage({ chatId, text: REPLIES[locale].hello });
  return NextResponse.json({ ok: true });
}
