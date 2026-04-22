import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "@/components/layout/page-header";
import { getTable } from "@/lib/admin/tables";
import { RowForm } from "../row-form";

type Props = { params: Promise<{ locale: string; table: string }> };

export default async function AdminDbNewRowPage({ params }: Props) {
  const { locale, table } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminDb");
  const tbl = getTable(table);
  if (!tbl) notFound();

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
        eyebrow={`Admin · DB · ${tbl.name}`}
        title={t("new_row_title", { table: tbl.label })}
        subtitle={t("new_row_subtitle")}
      />

      <div className="surface-card">
        <RowForm table={tbl} initial={null} />
      </div>
    </div>
  );
}
