import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

async function handle(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // Read the user's preferred locale before destroying the session so the
  // landing page lands in the right language.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let locale: string = routing.defaultLocale;
  if (user) {
    const { data: profile } = (await supabase
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .maybeSingle()) as { data: { locale: "ru" | "en" } | null };
    if (profile?.locale && (routing.locales as readonly string[]).includes(profile.locale)) {
      locale = profile.locale;
    }
  }

  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/${locale}`, { status: 302 });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
