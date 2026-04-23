import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ArrowLeft, CheckCircle2, FileText } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { loadQuizVersionDetail } from "../actions";
import { QuestionsClient } from "./questions-client";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminQuizVersionPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminQuiz");

  const result = await loadQuizVersionDetail(id);
  if (!result.ok) {
    if (result.error === "not_found") notFound();
    if (result.error === "not_authenticated")
      redirect(`/${locale}/login?next=/admin/quiz`);
    redirect(`/${locale}/admin`);
  }

  const { version, questions } = result;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <Link
        href="/admin/quiz"
        className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("back_to_versions")}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl font-bold text-ink-900">
            v{version.version}
          </h1>
          <HelpPanel
            pageId="admin-quiz-version"
            variant="inline"
            why={t("detail.help.why")}
            what={[
              t("detail.help.what.1"),
              t("detail.help.what.2"),
              t("detail.help.what.3"),
              t("detail.help.what.4"),
            ]}
            result={[t("detail.help.result.1"), t("detail.help.result.2")]}
          />
          {version.is_active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-xs font-semibold text-grass-800">
              <CheckCircle2 className="h-3 w-3" /> {t("status_active")}
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700">
              {t("status_draft")}
            </span>
          )}
        </div>
        {version.notes && (
          <p className="inline-flex items-start gap-1.5 text-sm text-ink-600">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {version.notes}
          </p>
        )}
      </header>

      <QuestionsClient
        locale={locale as "pl" | "en" | "ru"}
        version={version}
        questions={questions}
      />
    </div>
  );
}
