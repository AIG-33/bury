import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveQuiz } from "./actions";
import { QuizClient } from "./quiz-client";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Surface } from "@/components/ui/surface";

type Props = { params: Promise<{ locale: string }> };

export default async function OnboardingQuizPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quiz");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { version, questions } = await loadActiveQuiz();

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        help={
          <HelpPanel
            pageId="onboarding-quiz"
            variant="inline"
            why={t("help.why")}
            what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
            result={[t("help.result.1"), t("help.result.2")]}
          />
        }
      />

      <Link
        href={`/${locale}/onboarding/import-lt`}
        className="group block"
      >
        <Surface variant="soft" className="lift-on-hover flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-700">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-grass-900">
              {t("import_lt_banner.title")}
            </p>
            <p className="mt-0.5 text-sm text-grass-800">{t("import_lt_banner.body")}</p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-grass-700 transition group-hover:translate-x-0.5" />
        </Surface>
      </Link>

      <QuizClient
        locale={locale as "ru" | "en"}
        versionId={version.id}
        questions={questions}
        copy={{
          next: t("ui.next"),
          prev: t("ui.prev"),
          submit: t("ui.submit"),
          step: t("ui.step"),
          required: t("ui.required"),
          done_title: t("done.title"),
          done_body: t("done.body"),
          done_cta: t("done.cta"),
          submitting: t("ui.submitting"),
          error: t("ui.error"),
          choose: t("ui.choose"),
        }}
      />
    </div>
  );
}
