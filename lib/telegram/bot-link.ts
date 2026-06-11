/**
 * Public deep link to the project's Telegram bot, or null when the bot
 * username isn't configured (the UI affordances then stay hidden).
 */
export function telegramBotUrl(): string | null {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  return username ? `https://t.me/${username}` : null;
}
