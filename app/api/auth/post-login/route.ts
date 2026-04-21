import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Post-login redirector — resolves where to send the user after a successful
// sign-in (password or fresh session). Mirrors the logic in
// /api/auth/callback so both flows end up in the same "first run" experience:
//   - no onboarding quiz yet      → /onboarding/quiz
//   - explicit "next" target      → honour it
//   - coach                       → /coach/dashboard
//   - player (onboarded)          → /me/rating
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const next = searchParams.get("next");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const q = next ? `?next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(`${origin}/pl/login${q}`);
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("onboarding_completed_at, is_coach, locale")
    .eq("id", user.id)
    .single()) as {
    data: {
      onboarding_completed_at: string | null;
      is_coach: boolean;
      locale: "pl" | "en" | "ru";
    } | null;
  };

  const locale = profile?.locale ?? "pl";

  // First login: force the onboarding quiz regardless of `next`, unless the
  // user is explicitly heading into the quiz already.
  if (!profile?.onboarding_completed_at) {
    return NextResponse.redirect(`${origin}/${locale}/onboarding/quiz`);
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
