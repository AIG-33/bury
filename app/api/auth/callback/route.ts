import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/pl/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/pl/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Decide post-login destination: if onboarding not done → quiz; else profile/dashboard.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
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

    // Explicit "next" target wins (e.g. /invite/<token> after acceptance flow).
    if (next && next !== "/") {
      const target = next.startsWith("/") ? next : `/${next}`;
      return NextResponse.redirect(`${origin}/${locale}${target}`);
    }

    if (!profile?.onboarding_completed_at) {
      return NextResponse.redirect(`${origin}/${locale}/onboarding/quiz`);
    }
    if (profile.is_coach) {
      return NextResponse.redirect(`${origin}/${locale}/coach/dashboard`);
    }
    return NextResponse.redirect(`${origin}/${locale}/me/profile`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
