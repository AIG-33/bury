import { setRequestLocale, getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LandingHero } from "@/components/landing/landing-hero";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CoachCta } from "@/components/landing/coach-cta";
import { FinalCta } from "@/components/landing/final-cta";

type Props = { params: Promise<{ locale: string }> };

type LandingHrefs = {
  primary: string;
  primaryLabelKey: "cta_primary" | "cta_primary_authed";
  secondary: string;
  rating: string;
  find: string;
  tournaments: string;
  coaches: string;
  coachCta: string;
};

// Resolve all landing CTAs in one Supabase round-trip.
// - Anonymous visitors: primary → /login (sign-up funnel),
//   secondary → /leaderboard (low-friction exploration), benefit cards
//   → public catalogues so guests can browse real data.
// - Signed-in player: primary → /me/rating (their dashboard), benefit cards
//   point at their personal pages.
// - Signed-in coach/admin: primary → /coach/dashboard.
async function resolveLandingHrefs(): Promise<LandingHrefs> {
  const fallback: LandingHrefs = {
    primary: "/login",
    primaryLabelKey: "cta_primary",
    secondary: "/leaderboard",
    rating: "/leaderboard",
    find: "/players",
    tournaments: "/tournaments",
    coaches: "/coaches",
    coachCta: "/login",
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
      primaryLabelKey: "cta_primary_authed",
      secondary: "/leaderboard",
      rating: "/me/rating",
      find: "/me/find",
      tournaments: "/me/tournaments",
      coaches: "/coaches",
      coachCta: isStaff ? "/coach/dashboard" : "/me/profile",
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
      <LandingHero
        primaryCtaHref={hrefs.primary}
        primaryCtaLabel={t(`hero.${hrefs.primaryLabelKey}`)}
        secondaryCtaHref={hrefs.secondary}
      />
      <BenefitsSection
        ratingHref={hrefs.rating}
        findHref={hrefs.find}
        tournamentsHref={hrefs.tournaments}
        coachesHref={hrefs.coaches}
      />
      <HowItWorks />
      <CoachCta ctaHref={hrefs.coachCta} />
      <FinalCta
        primaryCtaHref={hrefs.primary}
        primaryCtaLabel={t(`final.${hrefs.primaryLabelKey}`)}
        secondaryCtaHref={hrefs.secondary}
      />
    </>
  );
}
