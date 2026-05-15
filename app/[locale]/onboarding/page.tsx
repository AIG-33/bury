import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, Trophy, ArrowRight, ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";
import { LT_BASE_URL } from "@/lib/rating/external/liga-tennisa";
import { PageHeader } from "@/components/layout/page-header";

type Props = { params: Promise<{ locale: string }> };

/**
 * Onboarding entry point — shown once after sign-up. The player picks
 * between two paths to a starting Elo:
 *
 *   1. The 2-minute self-eval quiz (default for everyone).
 *   2. Importing an existing rating from Liga Tennisa
 *      (https://www.ligatennisa.com/), if they already play there.
 *
 * If the player's onboarding is already complete, we bounce them to
 * /me/rating so refreshing this URL doesn't show a confusing screen.
 */
export default async function OnboardingHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("onboardingHome");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = (await supabase
    .from("profiles")
    .select("onboarding_completed_at, is_coach")
    .eq("id", user.id)
    .single()) as {
    data: { onboarding_completed_at: string | null; is_coach: boolean } | null;
  };

  if (profile?.onboarding_completed_at) {
    redirect(`/${locale}/me/rating`);
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="onboarding-home"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Quiz */}
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/${locale}/onboarding/quiz` as any}
          className="surface-card lift-on-hover group flex flex-col gap-4"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-grass-100 text-grass-700">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-grass-900">{t("quiz.title")}</h2>
            <p className="text-sm text-ink-600">{t("quiz.body")}</p>
          </div>
          <ul className="space-y-1.5 text-xs text-ink-700">
            <li className="flex gap-1.5">
              <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-grass-500" />
              {t("quiz.bullet_1")}
            </li>
            <li className="flex gap-1.5">
              <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-grass-500" />
              {t("quiz.bullet_2")}
            </li>
            <li className="flex gap-1.5">
              <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-grass-500" />
              {t("quiz.bullet_3")}
            </li>
          </ul>
          <div className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-grass-700">
            {t("quiz.cta")}{" "}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </Link>

        {/* Liga Tennisa import */}
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/${locale}/onboarding/import-lt` as any}
          className="surface-soft lift-on-hover group flex flex-col gap-4"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-grass-200 text-grass-800">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-grass-900">
              {t("import_lt.title")}
            </h2>
            <p className="text-sm text-grass-800">{t("import_lt.body")}</p>
          </div>
          <ul className="space-y-1.5 text-xs text-grass-900">
            <li className="flex gap-1.5">
              <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-grass-600" />
              {t("import_lt.bullet_1")}
            </li>
            <li className="flex gap-1.5">
              <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-grass-600" />
              {t("import_lt.bullet_2")}
            </li>
            <li className="flex gap-1.5">
              <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-grass-600" />
              {t("import_lt.bullet_3")}
            </li>
          </ul>
          <div className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-grass-700">
            {t("import_lt.cta")}{" "}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>

      <p className="text-center text-xs text-ink-500">
        {t("source_note")}{" "}
        <a
          href={LT_BASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-grass-700 hover:underline"
        >
          ligatennisa.com <ExternalLink className="h-2.5 w-2.5" />
        </a>
        {profile?.is_coach && <> · {t("coach_note")}</>}
      </p>
    </div>
  );
}
