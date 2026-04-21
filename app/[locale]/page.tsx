import { setRequestLocale, getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LandingHero } from "@/components/landing/landing-hero";
import { PillarsSection } from "@/components/landing/pillars-section";
import { NavThemeBridge } from "@/components/landing/nav-theme-bridge";

type Props = { params: Promise<{ locale: string }> };

// If the user is signed in, route the primary CTA straight to their home.
// Coach (or admin) → coach dashboard; otherwise → player rating tab.
async function resolvePrimaryCtaHref(): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "/login";
    const { data: profile } = (await supabase
      .from("profiles")
      .select("is_coach, is_admin")
      .eq("id", user.id)
      .maybeSingle()) as {
      data: { is_coach: boolean; is_admin: boolean } | null;
    };
    if (profile?.is_coach || profile?.is_admin) return "/coach/dashboard";
    return "/me/rating";
  } catch {
    return "/login";
  }
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const ctaHref = await resolvePrimaryCtaHref();

  return (
    <>
      <NavThemeBridge theme="dark" />
      <LandingHero
        primaryCtaHref={ctaHref}
        primaryCtaLabel={t("hero.cta_primary")}
        secondaryCtaHref="/help-demo"
        secondaryCtaLabel={t("hero.cta_secondary")}
      />
      <PillarsSection />
    </>
  );
}
