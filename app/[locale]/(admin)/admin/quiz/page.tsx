import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { HelpPanel } from "@/components/help/help-panel";
import { loadQuizVersions } from "./actions";
import { QuizVersionsClient } from "./quiz-versions-client";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminQuizPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminQuiz");

  const result = await loadQuizVersions();
  if (!result.ok) {
    if (result.error === "not_authenticated") redirect(`/${locale}/login?next=/admin/quiz`);
    redirect(`/${locale}/admin`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-ink-900">{t("title")}</h1>
        <p className="text-ink-600">{t("subtitle")}</p>
      </header>

      <HelpPanel
        pageId="admin-quiz"
        why={t("help.why")}
        what={[t("help.what.1"), t("help.what.2"), t("help.what.3"), t("help.what.4")]}
        result={[t("help.result.1"), t("help.result.2")]}
      />

      <QuizVersionsClient initialVersions={result.versions} />
    </div>
  );
}
