import type { Provider } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPlatform, isNative } from "@/lib/capacitor/platform";

// Google / Apple sign-in that works on the web (full-page PKCE OAuth redirect)
// and inside the Capacitor shell (native id-token flow). Google's OAuth screen
// is blocked inside WebViews, so on native we use `@capgo/capacitor-social-login`
// to obtain a provider id-token and exchange it via `signInWithIdToken`, which
// sets the same sb-* cookies as the password path on www.playtennis.by.

export type OAuthProvider = "google" | "apple";

export type OAuthErrorCode = "cancelled" | "unavailable" | "no_id_token" | "sign_in_failed";

/** `detail` carries the raw plugin/Supabase error text for on-screen diagnostics. */
export type OAuthResult = { ok: true } | { ok: false; error: OAuthErrorCode; detail?: string };

export type OAuthSignInOptions = {
  /** Web PKCE OAuth redirect target (the existing /api/auth/callback route). */
  redirectTo: string;
  /** Native hard-navigation target once the session cookie is set. */
  postLoginUrl: string;
};

type SocialLoginPlugin = (typeof import("@capgo/capacitor-social-login"))["SocialLogin"];

let socialLoginInitialized = false;

export async function signInWithGoogle(options: OAuthSignInOptions): Promise<OAuthResult> {
  if (isNative()) return nativeIdTokenSignIn("google", options.postLoginUrl);
  return webOAuthSignIn("google", options.redirectTo);
}

export async function signInWithApple(options: OAuthSignInOptions): Promise<OAuthResult> {
  if (isNative()) return nativeIdTokenSignIn("apple", options.postLoginUrl);
  return webOAuthSignIn("apple", options.redirectTo);
}

async function webOAuthSignIn(provider: OAuthProvider, redirectTo: string): Promise<OAuthResult> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: { redirectTo },
  });
  // On success the browser is redirected to the provider, so this rarely
  // resolves; a resolved value with no error still means "in progress".
  if (error) {
    console.error(`[oauth] web ${provider} signInWithOAuth failed`, error);
    return { ok: false, error: "sign_in_failed", detail: error.message };
  }
  return { ok: true };
}

async function nativeIdTokenSignIn(
  provider: OAuthProvider,
  postLoginUrl: string,
): Promise<OAuthResult> {
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await initSocialLogin(SocialLogin);

    // Supabase re-hashes the raw nonce and compares it against the token's
    // `nonce` claim, so the provider must receive the SHA-256 digest and
    // Supabase the raw value.
    const { rawNonce, nonceDigest } = await createNoncePair();

    // Google: no explicit `scopes` — Android rejects any custom scopes unless
    // MainActivity implements ModifiedMainActivityForSocialLoginPlugin, and both
    // platforms default to email+profile+openid anyway, which is all the
    // id-token exchange needs.
    const result =
      provider === "google"
        ? (
            await SocialLogin.login({
              provider: "google",
              options: { nonce: nonceDigest },
            })
          ).result
        : (
            await SocialLogin.login({
              provider: "apple",
              options: { scopes: ["email", "name"], nonce: nonceDigest },
            })
          ).result;

    const token = extractIdToken(result);
    if (!token) {
      console.error(`[oauth] native ${provider} login returned no id-token`, result);
      return { ok: false, error: "no_id_token", detail: "no idToken in plugin response" };
    }

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithIdToken({
      provider,
      token,
      nonce: rawNonce,
    });
    if (error) {
      console.error(`[oauth] supabase signInWithIdToken failed for ${provider}`, error);
      return { ok: false, error: "sign_in_failed", detail: error.message };
    }

    // Hard navigate through the shared post-login redirector so the server
    // decides between onboarding, the coach dashboard and the rating page.
    window.location.assign(postLoginUrl);
    return { ok: true };
  } catch (error) {
    const code = classifyOAuthError(error);
    // A user closing the sheet is expected; anything else is a config/runtime
    // failure whose raw text we need to see on the device (DEVELOPER_ERROR,
    // status codes like "10:", missing SHA-1, ...).
    if (code === "cancelled") return { ok: false, error: code };
    console.error(`[oauth] native ${provider} sign-in threw`, error);
    return { ok: false, error: code, detail: readErrorMessage(error) || undefined };
  }
}

async function initSocialLogin(SocialLogin: SocialLoginPlugin): Promise<void> {
  if (socialLoginInitialized) return;
  await SocialLogin.initialize({
    google: {
      webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      // iOS offline / server verification uses the Web client ID as audience.
      iOSServerClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    },
    apple: {
      // iOS ignores clientId (uses the bundle id); Android needs the Apple
      // Services ID plus a server redirect URL that lands back in the app.
      clientId: process.env.NEXT_PUBLIC_APPLE_SERVICES_ID,
      // On iOS the redirectUrl MUST be empty: a non-empty value makes the
      // plugin POST the authorization code to that backend (the Android web
      // flow) and expect a `success=true` redirect. Supabase's /auth/v1/callback
      // answers that POST with `bad_oauth_callback`, so native Apple sign-in
      // failed with "Success path component not provided." after the user
      // authorized (App Review rejection 2026-07-14, Guideline 2.1(a)).
      // With an empty redirectUrl the plugin returns the identityToken
      // directly and we exchange it via signInWithIdToken below.
      redirectUrl: getPlatform() === "ios" ? "" : process.env.NEXT_PUBLIC_APPLE_REDIRECT_URL,
    },
  });
  socialLoginInitialized = true;
}

/**
 * Reads the OIDC id-token from a plugin login result. Google (online) and Apple
 * both expose it as `result.idToken`; the offline Google response omits it.
 */
export function extractIdToken(result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null;
  const token = (result as { idToken?: unknown }).idToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/** Maps a thrown plugin/Supabase error onto the {ok:false} error contract. */
export function classifyOAuthError(error: unknown): OAuthErrorCode {
  const message = readErrorMessage(error).toLowerCase();
  if (!message) return "sign_in_failed";
  if (/(cancel|dismiss|user_cancel|12501|1001|(^|[^0-9])-5([^0-9]|$))/.test(message)) {
    return "cancelled";
  }
  if (
    /(unavailable|not available|no ?credential|no google|unimplemented|not implemented|developer console)/.test(
      message,
    )
  ) {
    return "unavailable";
  }
  return "sign_in_failed";
}

/** UI shows one of two strings; anything that isn't a device/config gap is generic. */
export function oauthErrorLabelKey(code: OAuthErrorCode): "oauth_error" | "oauth_unavailable" {
  return code === "unavailable" ? "oauth_unavailable" : "oauth_error";
}

function readErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as { message?: unknown; code?: unknown };
    if (typeof record.message === "string") return record.message;
    if (typeof record.code === "string") return record.code;
    if (typeof record.code === "number") return String(record.code);
  }
  return "";
}

export async function createNoncePair(): Promise<{ rawNonce: string; nonceDigest: string }> {
  const rawNonce = generateRawNonce();
  const nonceDigest = await sha256Hex(rawNonce);
  return { rawNonce, nonceDigest };
}

export function generateRawNonce(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
