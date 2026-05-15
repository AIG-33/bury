/**
 * Minimal Telegram Bot API helper.
 *
 * We do NOT spin up a long-running `grammy` Bot instance for sending — every
 * call hits the HTTP endpoint directly with `fetch`. This keeps the helper
 * usable from edge / server actions / cron without worrying about runtime
 * polling or singletons.
 *
 * If `TELEGRAM_BOT_TOKEN` is not set the helper degrades to a no-op so local
 * dev and the CI database still work (and tests don't need to mock fetch).
 */

export type TelegramSendResult = { ok: true; messageId: number } | { ok: false; error: string };

const API_BASE = "https://api.telegram.org";

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export async function sendTelegramMessage(opts: {
  chatId: number | string;
  text: string;
  /** Telegram supports `HTML` (recommended) or `MarkdownV2`. Defaults to HTML. */
  parseMode?: "HTML" | "MarkdownV2";
  disableLinkPreview?: boolean;
}): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "telegram_not_configured" };
  }
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: opts.parseMode ?? "HTML",
        disable_web_page_preview: opts.disableLinkPreview ?? false,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    } | null;
    if (!res.ok || !body?.ok) {
      return {
        ok: false,
        error: body?.description ?? `telegram_http_${res.status}`,
      };
    }
    return { ok: true, messageId: body.result?.message_id ?? 0 };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "telegram_send_failed",
    };
  }
}

/**
 * Escape a string for Telegram `parse_mode: HTML`. Only `<`, `>`, `&` need
 * escaping. We do NOT strip — UI clients accept emoji & unicode just fine.
 */
export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
