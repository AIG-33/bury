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

// Product decision: the bot speaks Russian only — the audience is Belarus,
// and a single voice keeps the copy maintainable.
const REPLIES = {
  linked:
    "🎾 Готово! PlayTennis.by теперь будет писать сюда об уведомлениях: новые предложения матчей и принятия. Изменить можно в профиле.",
  bad_token:
    "Не получилось привязать аккаунт. Открой ссылку «Подключить Telegram» в своём профиле PlayTennis.by ещё раз.",
  hello:
    "Привет! Это бот PlayTennis — бесплатной платформы любительского тенниса.\n\n" +
    "🔔 Уведомления о матчах: открой свой профиль на www.playtennis.by и нажми «Подключить Telegram».\n\n" +
    "💬 Проект бесплатный и развивается на вашей обратной связи: пиши прямо сюда предложения, что сделать лучше, или сообщай, если что-то не работает, — мы читаем всё.",
  feedback_thanks:
    "Спасибо! Сообщение получено 🎾 Мы читаем всё и учитываем при развитии проекта.",
} as const;

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

  const text = (msg.text ?? "").trim();
  if (text.startsWith("/start")) {
    const arg = text.slice("/start".length).trim();
    if (!arg) {
      await sendTelegramMessage({ chatId, text: REPLIES.hello });
      return NextResponse.json({ ok: true });
    }
    const userId = verifyTelegramLinkToken(arg);
    if (!userId) {
      await sendTelegramMessage({ chatId, text: REPLIES.bad_token });
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
      text: error ? REPLIES.bad_token : REPLIES.linked,
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
      text: `💬 Фидбек от ${sender} (chat_id ${chatId}):\n\n${text}`,
    });
    await sendTelegramMessage({ chatId, text: REPLIES.feedback_thanks });
    return NextResponse.json({ ok: true });
  }

  await sendTelegramMessage({ chatId, text: REPLIES.hello });
  return NextResponse.json({ ok: true });
}
