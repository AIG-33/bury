import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { getTable } from "@/lib/admin/tables";
import { getRow } from "../../actions";
import { RowForm } from "../row-form";

type Props = { params: Promise<{ locale: string; table: string; id: string }> };

export default async function AdminDbEditRowPage({ params }: Props) {
  const { locale, table, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminDb");
  const tbl = getTable(table);
  if (!tbl) notFound();

  const result = await getRow(tbl.name, id);

  return (
    <div className="page-shell space-y-6">
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={`/admin/db/${tbl.name}` as any}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 transition hover:text-grass-700"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {t("back_to_table", { table: tbl.label })}
      </Link>

      <PageHeader
        eyebrow={t("eyebrow", { table: tbl.name })}
        title={t("edit_row_title", { table: tbl.label })}
        subtitle={
          result.ok
            ? t("edit_row_subtitle_id", { id })
            : t("edit_row_subtitle")
        }
        help={
          <HelpPanel
            pageId={`admin-db-${tbl.name}-edit`}
            variant="inline"
            why={t("edit_row_help.why", { table: tbl.label })}
            what={[
              t("edit_row_help.what.1"),
              t("edit_row_help.what.2"),
              t("edit_row_help.what.3"),
            ]}
            result={[
              t("edit_row_help.result.1"),
              t("edit_row_help.result.2", { table: tbl.label }),
            ]}
          />
        }
      />

      <div className="surface-card">
        {!result.ok ? (
          <div className="text-clay-700">
            {t("error_load")}: <span className="font-mono">{result.error}</span>
          </div>
        ) : (
          <RowForm table={tbl} initial={result.row} />
        )}
      </div>
    </div>
  );
}
