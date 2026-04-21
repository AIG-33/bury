import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveQuiz } from "./actions";
import { QuizClient } from "./quiz-client";
import { HelpPanel } from "@/components/help/help-panel";

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
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="onboarding-quiz"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <QuizClient
        locale={locale as "pl" | "en" | "ru"}
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
