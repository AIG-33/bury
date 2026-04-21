import crypto from "node:crypto";

export type InvitationToken = {
  /** url-safe token, given to the recipient */
  token: string;
  /** sha256 of the token, stored in DB */
  hash: string;
};

export function createInvitationToken(): InvitationToken {
  const raw = crypto.randomBytes(32);
  const token = raw.toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function hashInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const INVITATION_TTL_DAYS = 14;
