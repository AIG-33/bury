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

export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

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
