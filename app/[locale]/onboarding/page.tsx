import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";
import { LT_BASE_URL } from "@/lib/rating/external/liga-tennisa";
import { PageHeader } from "@/components/layout/page-header";
import { LtQuickImport } from "./lt-quick-import";

type Props = { params: Promise<{ locale: string }> };

/**
 * Onboarding entry point — shown once after sign-up. Optimised for speed:
 * the Liga Tennisa name search lives inline right here (type → live
 * results → one-tap import), with the self-eval quiz as the secondary
 * path and a skip link for players who want to set things up later.
 *
 * If the player's onboarding is already complete, we bounce them to
 * /me/rating so refreshing this URL doesn't show a confusing screen.
 */
export default async function OnboardingHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("onboardingHome");
  // Error / candidate strings are shared with the full import page so the
  // two flows never drift apart.
  const tImport = await getTranslations("onboardingImportLt");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = (await supabase
    .from("profiles")
    .select("onboarding_completed_at, is_coach, first_name, last_name")
    .eq("id", user.id)
    .single()) as {
    data: {
      onboarding_completed_at: string | null;
      is_coach: boolean;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };

  if (profile?.onboarding_completed_at) {
    redirect(`/${locale}/me/rating`);
  }

  // Pre-fill the search with the signup name so most players see their LT
  // profile without typing anything.
  const initialQuery = [profile?.first_name ?? "", profile?.last_name ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-xl space-y-6">
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

        <LtQuickImport
          locale={locale as "ru" | "en"}
          initialQuery={initialQuery}
          copy={{
            search: {
              label: t("search.label"),
              placeholder: t("search.placeholder"),
              no_results: t("search.no_results"),
            },
            candidate: {
              anonymous: tImport("candidate.anonymous"),
              no_city: tImport("candidate.no_city"),
            },
            confirm: {
              lt_elo: t("confirm.lt_elo"),
              // {elo} is substituted client-side once the value is known.
              start_elo: t.raw("confirm.start_elo") as string,
              cta: t("confirm.cta"),
              cta_busy: t("confirm.cta_busy"),
              back: t("confirm.back"),
            },
            done: {
              title: t("done.title"),
              body: t.raw("done.body") as string,
              cta: t("done.cta"),
            },
            or: t("or"),
            quiz_hint: t("quiz_hint"),
            quiz_cta: t("quiz_cta"),
            skip: t("skip"),
            errors: {
              invalid_query: tImport("errors.invalid_query"),
              invalid_payload: tImport("errors.invalid_payload"),
              not_authenticated: tImport("errors.not_authenticated"),
              upstream_unreachable: tImport("errors.upstream_unreachable"),
              upstream_error: tImport("errors.upstream_error"),
              player_not_found: tImport("errors.player_not_found"),
              already_claimed_by_other_user: tImport("errors.already_claimed_by_other_user"),
              already_imported: tImport("errors.already_imported"),
              db_error: tImport("errors.db_error"),
              unknown: tImport("errors.unknown"),
            },
          }}
        />

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
    </div>
  );
}
