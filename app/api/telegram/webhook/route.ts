/**
 * Telegram Bot webhook.
 *
 * What we handle (intentionally minimal):
 *   - `/start <token>` — verifies the HMAC, binds the chat to the user's
 *     profile via `telegram_links` (upsert by `player_id`), and posts a
 *     short confirmation back to the chat.
 *   - everything else — treated as user feedback: forwarded to the
 *     `TELEGRAM_FEEDBACK_CHAT_ID` chat (if configured) and acknowledged.
 *     Without that env we fall back to the "what is this bot" reply so
 *     feedback is never silently swallowed.
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
  from?: {
    id: number;
    language_code?: string;
    username?: string;
    first_name?: string;
  };
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
      "Привет! Это бот PlayTennis.by — бесплатной платформы любительского тенниса в Беларуси.\n\n" +
      "🔔 Уведомления о матчах: открой свой профиль на www.playtennis.by и нажми «Подключить Telegram».\n\n" +
      "💬 Проект бесплатный и развивается на вашей обратной связи: пиши прямо сюда предложения, что сделать лучше, или сообщай, если что-то не работает, — мы читаем всё.",
    feedback_thanks:
      "Спасибо! Сообщение получено 🎾 Мы читаем всё и учитываем при развитии проекта.",
  },
  en: {
    linked:
      "🎾 Done! PlayTennis.by will now send notifications here — match proposals and acceptances. You can change this in your profile.",
    bad_token:
      "Couldn't link the account. Open the 'Connect Telegram' link in your PlayTennis.by profile again.",
    hello:
      "Hi! This is the bot of PlayTennis.by — a free amateur tennis platform in Belarus.\n\n" +
      "🔔 Match notifications: open your profile on www.playtennis.by and click 'Connect Telegram'.\n\n" +
      "💬 The project is free and grows on your feedback: send your ideas or report anything broken right here — we read everything.",
    feedback_thanks:
      "Thanks! Message received 🎾 We read everything and use it to improve the project.",
  },
} as const;

function pickLocale(code?: string): "ru" | "en" {
  return code && code.startsWith("ru") ? "ru" : "en";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: without the shared secret we cannot authenticate Telegram,
    // so we must not process updates that mutate telegram_links/profiles.
    console.error(
      "[telegram/webhook] TELEGRAM_WEBHOOK_SECRET is not configured — rejecting update",
    );
    return NextResponse.json(
      { ok: false, error: "webhook_not_configured" },
      { status: 503 },
    );
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

  // Any other text message = user feedback (ideas, bug reports). Forward it
  // to the maintainers' chat when configured, otherwise explain the bot.
  const feedbackChatId = Number(process.env.TELEGRAM_FEEDBACK_CHAT_ID ?? "");
  if (text && Number.isFinite(feedbackChatId) && feedbackChatId !== 0) {
    const sender = msg.from?.username
      ? `@${msg.from.username}`
      : (msg.from?.first_name ?? `chat ${chatId}`);
    await sendTelegramMessage({
      chatId: feedbackChatId,
      text: `💬 Feedback от ${sender} (chat_id ${chatId}):\n\n${text}`,
    });
    await sendTelegramMessage({ chatId, text: REPLIES[locale].feedback_thanks });
    return NextResponse.json({ ok: true });
  }

  await sendTelegramMessage({ chatId, text: REPLIES[locale].hello });
  return NextResponse.json({ ok: true });
}
