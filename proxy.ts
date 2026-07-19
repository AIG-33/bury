import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 calls this file `proxy.ts` (renamed from `middleware.ts`).
// We chain two responsibilities:
//   1. Supabase session refresh — reads the current cookies, runs
//      `supabase.auth.getUser()` so expired access tokens get a refresh
//      round-trip, and writes the (possibly rotated) cookies back onto the
//      response. Without this the SSR client stays stuck with a stale token
//      after ~1 h and pages start seeing `null` users.
//   2. next-intl locale routing — adds the `/ru` or `/en` prefix and resolves
//      the request locale for getTranslations/setRequestLocale.
//
// Order: we let next-intl decide on the response first (it may issue a
// redirect for `/` → `/ru`), then we attach Supabase cookies onto whatever
// response we got. Both rewrites and redirects carry cookies just fine.

const intlMiddleware = createIntlMiddleware(routing);

/**
 * The Capacitor shell appends "PlayTennisApp" to the WebView user-agent
 * (capacitor.config.ts → appendUserAgent). When the store app opens the site
 * root, send it to the mobile UI (`/[locale]/m`) instead of the web landing.
 * Deep links to inner pages are left untouched so shared URLs still work.
 */
function nativeAppRedirect(request: NextRequest): NextResponse | null {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua.includes("PlayTennisApp")) return null;

  const { pathname } = request.nextUrl;
  const rootMatch = pathname.match(/^\/(ru|en)\/?$/);
  if (pathname !== "/" && !rootMatch) return null;

  const locale = rootMatch?.[1] ?? routing.defaultLocale;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/m`;
  return NextResponse.redirect(url);
}

/**
 * next-intl issues temporary redirects for `/` → `/{locale}`. Upgrade the
 * bare-root case to 308 so Search Console consolidates ranking signals on
 * the canonical locale URL (and stops flagging www root as a soft redirect).
 */
function upgradeRootLocaleRedirect(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (response.status !== 307 && response.status !== 302) return response;
  if (request.nextUrl.pathname !== "/") return response;
  const location = response.headers.get("location");
  if (!location) return response;

  const upgraded = NextResponse.redirect(new URL(location, request.url), 308);
  response.cookies.getAll().forEach((cookie) => {
    upgraded.cookies.set(cookie.name, cookie.value);
  });
  return upgraded;
}

export default async function proxy(request: NextRequest) {
  const response = upgradeRootLocaleRedirect(
    request,
    nativeAppRedirect(request) ?? intlMiddleware(request),
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANT: do not remove. `getUser()` triggers the refresh-token flow
  // when the access token is close to expiry; the rotated cookies are then
  // flushed onto `response` via `setAll` above.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip the proxy for API routes, Next.js internals, Vercel internals, and
  // any path that looks like a static asset (contains a `.`). API routes
  // create their own Supabase server client per request, so they don't need
  // session refresh in the proxy.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
