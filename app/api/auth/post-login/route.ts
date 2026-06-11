import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

// Post-login redirector — resolves where to send the user after a successful
// sign-in (password or fresh session). Mirrors the logic in
// /api/auth/callback so both flows end up in the same "first run" experience:
//   - no onboarding completed     → /onboarding (chooser: quiz vs. LT import)
//   - explicit "next" target      → honour it
//   - coach                       → /coach/dashboard
//   - player (onboarded)          → /me/rating
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const next = searchParams.get("next");

  // Same locale hint as /api/auth/callback and /api/auth/confirm: the
  // NEXT_LOCALE cookie set by next-intl on previous visits.
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const fallbackLocale = (routing.locales as readonly string[]).includes(cookieLocale ?? "")
    ? (cookieLocale as string)
    : routing.defaultLocale;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const q = next ? `?next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(`${origin}/${fallbackLocale}/login${q}`);
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

  // Coach-invite links must survive the first-login onboarding gate: the
  // invite page auto-accepts for authenticated users and then forwards
  // not-yet-onboarded players to /onboarding itself.
  if (next?.startsWith("/invite/")) {
    return NextResponse.redirect(`${origin}/${locale}${next}`);
  }

  // First login: force the onboarding chooser regardless of `next`. The
  // chooser lets the player pick between the self-eval quiz and importing
  // their existing rating from Liga Tennisa.
  if (!profile?.onboarding_completed_at) {
    return NextResponse.redirect(`${origin}/${locale}/onboarding`);
  }

  if (next && next !== "/") {
    const target = next.startsWith("/") ? next : `/${next}`;
    return NextResponse.redirect(`${origin}/${locale}${target}`);
  }

  if (profile.is_coach) {
    return NextResponse.redirect(`${origin}/${locale}/coach/dashboard`);
  }
  return NextResponse.redirect(`${origin}/${locale}/me/rating`);
}
