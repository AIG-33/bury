import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ChevronLeft, CheckCircle2, FileText } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Chip } from "@/components/ui/surface";
import { loadRatingConfigDetail } from "../actions";
import { RatingEditor } from "./rating-editor";
import type { AlgorithmConfig } from "@/lib/quiz/schema";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminRatingDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminRating");

  const result = await loadRatingConfigDetail(id);
  if (!result.ok) {
    if (result.error === "not_found") notFound();
    if (result.error === "not_authenticated")
      redirect(`/${locale}/login?next=/admin/rating`);
    redirect(`/${locale}/admin`);
  }

  const { row } = result;

  return (
    <div className="page-shell space-y-8">
      <Link
        href="/admin/rating"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 transition hover:text-grass-700"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> {t("back_to_list")}
      </Link>

      <PageHeader
        eyebrow={t("eyebrow")}
        title={`v${row.version}`}
        subtitle={
          row.notes ? (
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {row.notes}
            </span>
          ) : undefined
        }
        help={
          <HelpPanel
            pageId="admin-rating-detail"
            variant="inline"
            why={t("editor.help.why")}
            what={[
              t("editor.help.what.1"),
              t("editor.help.what.2"),
              t("editor.help.what.3"),
              t("editor.help.what.4"),
            ]}
            result={[t("editor.help.result.1"), t("editor.help.result.2")]}
          />
        }
        actions={
          row.is_active ? (
            <Chip tone="grass" className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {t("status_active")}
            </Chip>
          ) : (
            <Chip tone="neutral">{t("status_draft")}</Chip>
          )
        }
      />

      <RatingEditor
        id={row.id}
        isActive={row.is_active}
        initialConfig={row.config as AlgorithmConfig}
        initialNotes={row.notes}
      />
    </div>
  );
}
