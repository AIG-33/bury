import { setRequestLocale, getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LandingHero } from "@/components/landing/landing-hero";
import { PillarsSection } from "@/components/landing/pillars-section";

type Props = { params: Promise<{ locale: string }> };

type LandingHrefs = {
  primary: string;
  rating: string;
  find: string;
  tournaments: string;
};

// Resolve all landing CTAs in one Supabase round-trip.
// Signed-in coach/admin → coach dashboard; signed-in player → player area.
// Anonymous visitors get sent to PUBLIC catalogues whenever possible — only
// the homepage's primary CTA pushes them toward /login. Critically, the
// "find a sparring partner" pillar now points at the public `/players`
// catalogue so guests can see real opponents before deciding to register.
async function resolveLandingHrefs(): Promise<LandingHrefs> {
  const fallback: LandingHrefs = {
    primary: "/login",
    rating: "/coaches",
    find: "/players",
    tournaments: "/tournaments",
  };
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fallback;
    const { data: profile } = (await supabase
      .from("profiles")
      .select("is_coach, is_admin")
      .eq("id", user.id)
      .maybeSingle()) as {
      data: { is_coach: boolean; is_admin: boolean } | null;
    };
    const isStaff = !!(profile?.is_coach || profile?.is_admin);
    return {
      primary: isStaff ? "/coach/dashboard" : "/me/rating",
      rating: "/coaches",
      find: "/me/find",
      tournaments: "/me/tournaments",
    };
  } catch {
    return fallback;
  }
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const hrefs = await resolveLandingHrefs();

  return (
    <>
      <LandingHero primaryCtaHref={hrefs.primary} primaryCtaLabel={t("hero.cta_primary")} />
      <PillarsSection
        ratingHref={hrefs.rating}
        findHref={hrefs.find}
        tournamentsHref={hrefs.tournaments}
      />
    </>
  );
}
