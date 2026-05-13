import { createHash, randomBytes } from "crypto";

/**
 * Multi-use invite token for closed clubs.
 *
 * Stored on `clubs.invite_token_hash` as the SHA-256 hex digest of the raw
 * token. The raw token only ever lives in the URL the owner shares; it is
 * NEVER persisted in the DB or logs. Hashing lets us:
 *
 *   * compare server-side without storing the secret;
 *   * make rotation trivial — generate a new token, overwrite the hash,
 *     the old URL becomes 404 immediately.
 */
export function generateInviteToken(): { token: string; hash: string } {
  // 24 random bytes → 32 base64url chars; plenty of entropy, fits in a URL.
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
