/**
 * HMAC-signed deep-link tokens for "Connect Telegram".
 *
 * Goal: let a logged-in user click `https://t.me/<bot>?start=<token>` and have
 * the webhook bind their telegram chat_id to their profile, WITHOUT requiring
 * any pre-state in the database.
 *
 * Token layout: `<user_id>.<sig>` where `sig` is the first 16 hex chars of
 * `HMAC-SHA256(secret, user_id)`. Stateless, unguessable, and tied to a
 * single user. The secret comes from `TELEGRAM_WEBHOOK_SECRET` (already in
 * `.env.example`); if missing, mint/verify both fail closed.
 *
 * The token does not embed an expiry — the worst case if someone leaks the
 * token is that an attacker can claim ownership of THEIR OWN telegram chat
 * (or unbind a victim's chat by sending /start on it). That's an acceptable
 * trade-off for a sparring app; we can add `?ts=` later if we ever need it.
 */

import { createHmac } from "node:crypto";

const SIG_LEN = 16; // 64 bits of entropy — enough for this use case.

function secret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET || null;
}

export function mintTelegramLinkToken(userId: string): string | null {
  const s = secret();
  if (!s) return null;
  const sig = createHmac("sha256", s).update(userId).digest("hex").slice(0, SIG_LEN);
  return `${userId}.${sig}`;
}

export function verifyTelegramLinkToken(token: string): string | null {
  const s = secret();
  if (!s) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!userId || sig.length !== SIG_LEN) return null;
  const expected = createHmac("sha256", s).update(userId).digest("hex").slice(0, SIG_LEN);
  // Timing-safe-ish: lengths equal + identical strings.
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0 ? userId : null;
}
