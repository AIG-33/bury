import { describe, it, expect } from "vitest";
import {
  createInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_DAYS,
} from "../token";

describe("invitation token", () => {
  it("generates url-safe token + matching sha256", () => {
    const { token, hash } = createInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("re-hashing yields the same value", () => {
    const { token, hash } = createInvitationToken();
    expect(hashInvitationToken(token)).toBe(hash);
  });

  it("different tokens produce different hashes", () => {
    const a = createInvitationToken();
    const b = createInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it("uses 14-day TTL by default", () => {
    expect(INVITATION_TTL_DAYS).toBe(14);
  });
});
