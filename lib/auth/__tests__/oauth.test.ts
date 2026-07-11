import { describe, it, expect } from "vitest";
import {
  extractIdToken,
  classifyOAuthError,
  oauthErrorLabelKey,
  generateRawNonce,
  sha256Hex,
  createNoncePair,
} from "../oauth";

describe("extractIdToken", () => {
  it("reads idToken from a Google/Apple online result", () => {
    expect(extractIdToken({ idToken: "abc.def.ghi" })).toBe("abc.def.ghi");
  });

  it("returns null for the offline Google response (no id token)", () => {
    expect(extractIdToken({ serverAuthCode: "code", responseType: "offline" })).toBeNull();
  });

  it("returns null for empty / non-string / missing tokens", () => {
    expect(extractIdToken({ idToken: "" })).toBeNull();
    expect(extractIdToken({ idToken: 123 })).toBeNull();
    expect(extractIdToken({})).toBeNull();
    expect(extractIdToken(null)).toBeNull();
    expect(extractIdToken(undefined)).toBeNull();
    expect(extractIdToken("nope")).toBeNull();
  });
});

describe("classifyOAuthError", () => {
  it("detects user cancellation across platforms", () => {
    expect(classifyOAuthError(new Error("The user canceled the sign-in flow."))).toBe(
      "cancelled",
    );
    expect(classifyOAuthError("USER_CANCELLED")).toBe("cancelled");
    expect(classifyOAuthError({ code: "1001" })).toBe("cancelled");
    expect(classifyOAuthError({ message: "Sign in dismissed" })).toBe("cancelled");
  });

  it("detects unavailable / misconfigured providers", () => {
    expect(classifyOAuthError(new Error("NoCredentialException: No credentials available"))).toBe(
      "unavailable",
    );
    expect(classifyOAuthError("Google is not available on this device")).toBe("unavailable");
    expect(
      classifyOAuthError(new Error("[28444] Developer console is not set up correctly")),
    ).toBe("unavailable");
  });

  it("falls back to sign_in_failed for unknown/empty errors", () => {
    expect(classifyOAuthError(new Error("boom"))).toBe("sign_in_failed");
    expect(classifyOAuthError({})).toBe("sign_in_failed");
    expect(classifyOAuthError(null)).toBe("sign_in_failed");
  });
});

describe("oauthErrorLabelKey", () => {
  it("maps unavailable to its dedicated string and everything else to generic", () => {
    expect(oauthErrorLabelKey("unavailable")).toBe("oauth_unavailable");
    expect(oauthErrorLabelKey("cancelled")).toBe("oauth_error");
    expect(oauthErrorLabelKey("no_id_token")).toBe("oauth_error");
    expect(oauthErrorLabelKey("sign_in_failed")).toBe("oauth_error");
  });
});

describe("nonce helpers", () => {
  it("generates a hex nonce of the expected length", () => {
    const nonce = generateRawNonce(32);
    expect(nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(generateRawNonce()).not.toBe(generateRawNonce());
  });

  it("sha256Hex matches a known digest", async () => {
    // echo -n "abc" | sha256sum
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("createNoncePair returns raw + its SHA-256 digest", async () => {
    const { rawNonce, nonceDigest } = await createNoncePair();
    expect(rawNonce).toMatch(/^[a-f0-9]{64}$/);
    expect(nonceDigest).toBe(await sha256Hex(rawNonce));
  });
});
