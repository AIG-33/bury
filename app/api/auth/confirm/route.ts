import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

// Email confirmation endpoint that accepts the OTP `token_hash` Supabase
// sends in transactional emails (signup, magic link, recovery, email
// change). Unlike PKCE, this flow does NOT require a code_verifier on the
// originating browser — so the user can open the email on a different
// device and still complete the auth handshake.
//
// Wire this URL into the email templates in the Supabase Dashboard:
//   {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>
//
// Where <type> is `signup` | `magiclink` | `recovery` | `email_change` and
// <path> is the post-auth destination (defaults to `/`).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const fallbackLocale = (routing.locales as readonly string[]).includes(cookieLocale ?? "")
    ? (cookieLocale as string)
    : routing.defaultLocale;

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/${fallbackLocale}/login?error=missing_token`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/${fallbackLocale}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/${fallbackLocale}/login?error=no_session`);
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

  // Recovery flow always goes to /auth/update-password (or whatever
  // explicit `next` was passed). The user must set a new password while
  // the recovery session is fresh.
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
