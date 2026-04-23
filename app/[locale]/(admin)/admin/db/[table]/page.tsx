import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Plus, ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { HelpPanel } from "@/components/help/help-panel";
import { PageHeader } from "@/components/layout/page-header";
import { getTable } from "@/lib/admin/tables";
import { listRows } from "../actions";
import { TableClient } from "./table-client";

type Props = {
  params: Promise<{ locale: string; table: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickStr(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function AdminDbTablePage({ params, searchParams }: Props) {
  const { locale, table } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("adminDb");

  const tbl = getTable(table);
  if (!tbl) notFound();

  const page = Math.max(1, Number(pickStr(sp.page) ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(5, Number(pickStr(sp.pageSize) ?? 25) || 25));
  const search = pickStr(sp.q);
  const sortColRaw = pickStr(sp.sort);
  const sortDirRaw = pickStr(sp.dir);
  const sort =
    sortColRaw && tbl.columns.some((c) => c.key === sortColRaw)
      ? { column: sortColRaw, ascending: sortDirRaw !== "desc" }
      : null;

  // Filters: any ?f_<col>=value
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (!k.startsWith("f_")) continue;
    const colKey = k.slice(2);
    const value = pickStr(v);
    if (value !== null && value !== "") filters[colKey] = value;
  }

  const result = await listRows({
    table: tbl.name,
    page,
    pageSize,
    search,
    sort,
    filters,
  });

  return (
    <div className="page-shell space-y-6">
      <div className="flex items-center justify-between">
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={"/admin/db" as any}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 transition hover:text-grass-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("back_to_tables")}
        </Link>
        {!tbl.disableInsert && (
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={`/admin/db/${tbl.name}/new` as any}
            className="inline-flex items-center gap-1.5 rounded-full bg-grass-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-grass-800"
          >
            <Plus className="h-4 w-4" />
            {t("new_row")}
          </Link>
        )}
      </div>

      <PageHeader
        eyebrow={`Admin · DB · ${tbl.name}`}
        title={tbl.label}
        subtitle={tbl.description}
        help={
          <HelpPanel
            pageId={`admin-db-${tbl.name}`}
            variant="inline"
            why={t("table_help.why", { table: tbl.label })}
            what={[
              t("table_help.what.1"),
              t("table_help.what.2"),
              t("table_help.what.3"),
            ]}
            result={[
              t("table_help.result.1", { table: tbl.label }),
              t("table_help.result.2"),
            ]}
          />
        }
      />

      {!result.ok ? (
        <div className="surface-card-flat border-clay-300 bg-clay-50/40 text-clay-800">
          {t("error_load")}: <span className="font-mono">{result.error}</span>
        </div>
      ) : (
        <TableClient
          table={tbl}
          rows={result.rows}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          search={search ?? ""}
          sort={sort}
          filters={filters}
        />
      )}
    </div>
  );
}
