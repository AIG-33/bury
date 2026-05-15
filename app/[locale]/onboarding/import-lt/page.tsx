import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HelpPanel } from "@/components/help/help-panel";
import { ImportLtClient } from "./import-client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ locale: string }> };

export default async function OnboardingImportLtPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("onboardingImportLt");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Pre-fill the search query with the user's profile name (if any).
  const { data: profile } = (await supabase
    .from("profiles")
    .select("first_name, last_name, city")
    .eq("id", user.id)
    .single()) as {
    data: {
      first_name: string | null;
      last_name: string | null;
      city: string | null;
    } | null;
  };

  const initialQuery = [profile?.first_name ?? "", profile?.last_name ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

  return (
    <div className="page-shell space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/onboarding`}>
            <ArrowLeft className="h-3 w-3" />
            {t("back")}
          </Link>
        </Button>
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          help={
            <HelpPanel
              pageId="onboarding-import-lt"
              variant="inline"
              why={t("help.why")}
              what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
              result={[t("help.result.1"), t("help.result.2")]}
            />
          }
        />
      </div>

      <ImportLtClient
        locale={locale as "ru" | "en"}
        initialQuery={initialQuery}
        initialCity={profile?.city ?? null}
        copy={{
          search: {
            label: t("search.label"),
            placeholder: t("search.placeholder"),
            city_label: t("search.city_label"),
            city_placeholder: t("search.city_placeholder"),
            cta: t("search.cta"),
            cta_busy: t("search.cta_busy"),
            min_chars: t("search.min_chars"),
            empty_title: t("search.empty_title"),
            empty_body: t("search.empty_body"),
            no_results_title: t("search.no_results_title"),
            no_results_body: t("search.no_results_body"),
          },
          candidate: {
            select: t("candidate.select"),
            score_hint: t("candidate.score_hint"),
            anonymous: t("candidate.anonymous"),
            no_city: t("candidate.no_city"),
          },
          preview: {
            title: t("preview.title"),
            tier: t("preview.tier"),
            singles_elo: t("preview.singles_elo"),
            doubles_elo: t("preview.doubles_elo"),
            calibrating: t("preview.calibrating"),
            ranking: t("preview.ranking"),
            wins: t("preview.wins"),
            seed_hint: t("preview.seed_hint"),
            seed_clamped_hint: t("preview.seed_clamped_hint"),
            seed_fallback_hint: t("preview.seed_fallback_hint"),
            copy_label: t("preview.copy_label"),
            copy_hint: t("preview.copy_hint"),
            confirm: t("preview.confirm"),
            confirm_busy: t("preview.confirm_busy"),
            cancel: t("preview.cancel"),
            view_on_lt: t("preview.view_on_lt"),
            disclaimer: t("preview.disclaimer"),
          },
          done: {
            title: t("done.title"),
            body: t("done.body"),
            cta: t("done.cta"),
          },
          errors: {
            invalid_query: t("errors.invalid_query"),
            invalid_payload: t("errors.invalid_payload"),
            not_authenticated: t("errors.not_authenticated"),
            upstream_unreachable: t("errors.upstream_unreachable"),
            upstream_error: t("errors.upstream_error"),
            player_not_found: t("errors.player_not_found"),
            already_claimed_by_other_user: t("errors.already_claimed_by_other_user"),
            already_imported: t("errors.already_imported"),
            db_error: t("errors.db_error"),
            unknown: t("errors.unknown"),
          },
        }}
      />
    </div>
  );
}
