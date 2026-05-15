import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ChevronLeft, CheckCircle2, FileText } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Chip } from "@/components/ui/surface";
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
    if (result.error === "not_authenticated") redirect(`/${locale}/login?next=/admin/quiz`);
    redirect(`/${locale}/admin`);
  }

  const { version, questions } = result;

  return (
    <div className="page-shell space-y-8">
      <Link
        href="/admin/quiz"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 transition hover:text-grass-700"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> {t("back_to_versions")}
      </Link>

      <PageHeader
        eyebrow="Admin · Quiz"
        title={`v${version.version}`}
        subtitle={
          version.notes ? (
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {version.notes}
            </span>
          ) : undefined
        }
        help={
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
        }
        actions={
          version.is_active ? (
            <Chip tone="grass" className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {t("status_active")}
            </Chip>
          ) : (
            <Chip tone="neutral">{t("status_draft")}</Chip>
          )
        }
      />

      <QuestionsClient locale={locale as "ru" | "en"} version={version} questions={questions} />
    </div>
  );
}
