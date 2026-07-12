import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

// PKCE / OAuth callback. Email-based flows (signup confirm, magic link,
// password recovery) should use `/api/auth/confirm` (token_hash) so the
// link is browser-portable. This route stays for OAuth providers and the
// rare same-browser PKCE recovery case.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Pull a hint at the user's preferred locale from the cookie set by
  // next-intl on previous visits. Falls back to `routing.defaultLocale`.
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const fallbackLocale = (routing.locales as readonly string[]).includes(cookieLocale ?? "")
    ? (cookieLocale as string)
    : routing.defaultLocale;

  // When the provider round-trip fails on the Supabase side (wrong client
  // secret, consent-screen denial, "Database error saving new user", ...),
  // GoTrue redirects back here with `error` / `error_description` and NO
  // `code`. Surface that instead of the misleading "missing_code".
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const q = new URLSearchParams({ error: "oauth_provider" });
    const description =
      searchParams.get("error_description") ?? searchParams.get("error_code") ?? oauthError;
    q.set("error_detail", description);
    return NextResponse.redirect(`${origin}/${fallbackLocale}/login?${q.toString()}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/${fallbackLocale}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/${fallbackLocale}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return resolvePostAuthDestination(supabase, origin, next, fallbackLocale);
}

async function resolvePostAuthDestination(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  origin: string,
  next: string,
  fallbackLocale: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/${fallbackLocale}${next === "/" ? "" : next}`);
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("onboarding_completed_at, is_coach, locale")
    .eq("id", user.id)
    .single()) as {
    data: {
      onboarding_completed_at: string | null;
      is_coach: boolean;
      locale: "ru" | "en";
    } | null;
  };

  const locale = profile?.locale ?? fallbackLocale;

  // Explicit "next" target wins. Common cases: `/auth/update-password`
  // for the recovery flow, `/invite/<token>` for the coach invitation.
  if (next && next !== "/") {
    const target = next.startsWith("/") ? next : `/${next}`;
    return NextResponse.redirect(`${origin}/${locale}${target}`);
  }

  if (!profile?.onboarding_completed_at) {
    return NextResponse.redirect(`${origin}/${locale}/onboarding`);
  }
  if (profile.is_coach) {
    return NextResponse.redirect(`${origin}/${locale}/coach/dashboard`);
  }
  return NextResponse.redirect(`${origin}/${locale}/me/rating`);
}
