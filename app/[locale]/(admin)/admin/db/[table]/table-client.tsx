"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listColumnsForList,
  type ColumnDef,
  type TableDef,
} from "@/lib/admin/tables";
import { deleteRow } from "../actions";

type Props = {
  table: TableDef;
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
  search: string;
  sort: { column: string; ascending: boolean } | null;
  filters: Record<string, string>;
};

export function TableClient({
  table,
  rows,
  total,
  page,
  pageSize,
  search,
  sort,
  filters,
}: Props) {
  const t = useTranslations("adminDb");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>(filters);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => listColumnsForList(table), [table]);
  const filterCols = useMemo(
    () => (table.filterColumns ?? []).map((k) => table.columns.find((c) => c.key === k)!).filter(Boolean),
    [table],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pushParams(next: URLSearchParams) {
    startTransition(() => {
      router.push(`?${next.toString()}` as never, { scroll: false });
    });
  }

  function setParam(name: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(name);
    else next.set(name, value);
    next.delete("page");
    pushParams(next);
  }

  function setSort(col: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (sort?.column === col) {
      next.set("dir", sort.ascending ? "desc" : "asc");
    } else {
      next.set("dir", "asc");
    }
    next.set("sort", col);
    pushParams(next);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(Math.max(1, Math.min(totalPages, p))));
    pushParams(next);
  }

  function applyFilters() {
    const next = new URLSearchParams(searchParams.toString());
    for (const k of Array.from(next.keys())) {
      if (k.startsWith("f_")) next.delete(k);
    }
    for (const [k, v] of Object.entries(filterDraft)) {
      if (v && v !== "") next.set(`f_${k}`, v);
    }
    next.delete("page");
    pushParams(next);
  }

  function clearFilters() {
    setFilterDraft({});
    setSearchInput("");
    const next = new URLSearchParams(searchParams.toString());
    for (const k of Array.from(next.keys())) {
      if (k.startsWith("f_") || k === "q" || k === "page") next.delete(k);
    }
    pushParams(next);
  }

  async function onDelete(id: string) {
    if (!confirm(t("confirm_delete", { table: table.label }))) return;
    setError(null);
    const res = await deleteRow(table.name, id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="space-y-4">
      {/* ---------- Toolbar: search + filters + page size ---------- */}
      <div className="surface-card-flat space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", searchInput || null);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          {table.searchColumns.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-500">
                {t("search")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("search_placeholder", {
                    fields: table.searchColumns.join(", "),
                  })}
                  className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-grass-500 focus:outline-none focus:ring-2 focus:ring-grass-200"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-500">
              {t("page_size")}
            </label>
            <select
              value={pageSize}
              onChange={(e) => setParam("pageSize", e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-2 focus:ring-grass-200"
            >
              {[10, 25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-grass-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-grass-800"
          >
            {t("apply")}
          </button>

          {(search || Object.keys(filters).length > 0) && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50"
            >
              <X className="h-3.5 w-3.5" />
              {t("clear")}
            </button>
          )}
        </form>

        {filterCols.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3">
            {filterCols.map((col) => (
              <div key={col.key}>
                <label className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-500">
                  {col.label}
                </label>
                <FilterInput
                  col={col}
                  value={filterDraft[col.key] ?? ""}
                  onChange={(v) => setFilterDraft((d) => ({ ...d, [col.key]: v }))}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-lg border border-grass-300 bg-grass-50 px-3 py-2 text-sm font-semibold text-grass-800 transition hover:bg-grass-100"
            >
              {t("apply_filters")}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="surface-card-flat border-clay-300 bg-clay-50/40 text-sm text-clay-800">
          {error}
        </div>
      )}

      {/* ---------- Table ---------- */}
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-50/70 text-ink-600">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-[0.18em]",
                    col.width,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-grass-700"
                  >
                    {col.label}
                    <SortIcon active={sort?.column === col.key} ascending={sort?.ascending ?? true} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-[0.18em]">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-ink-500">
                  {t("empty_rows")}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = String(row[table.pk] ?? "");
                return (
                  <tr key={id} className="border-t border-ink-100 transition hover:bg-grass-50/40">
                    {columns.map((col) => (
                      <td key={col.key} className="max-w-[280px] truncate px-3 py-2 align-top text-ink-800">
                        <CellValue col={col} value={row[col.key]} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          href={`/${locale}/admin/db/${table.name}/${id}` as any}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 transition hover:border-grass-300 hover:bg-grass-50 hover:text-grass-800"
                          title={t("edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onDelete(id)}
                          disabled={pending}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-clay-700 transition hover:border-clay-400 hover:bg-clay-50 disabled:opacity-50"
                          title={t("delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Pagination ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-ink-600">
        <div className="tabular-nums">
          {t("range_label", { start, end, total })}
        </div>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1 || pending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 font-mono text-xs tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages || pending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterInput({
  col,
  value,
  onChange,
}: {
  col: ColumnDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const tBase = "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-2 focus:ring-grass-200";
  if (col.type === "boolean") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={tBase}>
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (col.type === "select" && col.options) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={tBase}>
        <option value="">—</option>
        {col.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={tBase}
      placeholder="="
    />
  );
}

function SortIcon({ active, ascending }: { active: boolean; ascending: boolean }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-ink-400" />;
  return ascending ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function CellValue({ col, value }: { col: ColumnDef; value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="font-mono text-[11px] text-ink-400">NULL</span>;
  }
  if (col.type === "boolean") {
    return value ? (
      <span className="rounded-full bg-grass-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-grass-800">
        true
      </span>
    ) : (
      <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-600">
        false
      </span>
    );
  }
  if (col.type === "uuid") {
    return <span className="font-mono text-[11px] text-ink-600">{String(value).slice(0, 8)}…</span>;
  }
  if (col.type === "datetime" || col.type === "date") {
    try {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return <>{String(value)}</>;
      return (
        <span className="tabular-nums">
          {col.type === "date" ? d.toISOString().slice(0, 10) : d.toLocaleString()}
        </span>
      );
    } catch {
      return <>{String(value)}</>;
    }
  }
  if (col.type === "json") {
    return (
      <span className="font-mono text-[11px] text-ink-600">
        {JSON.stringify(value).slice(0, 60)}
      </span>
    );
  }
  if (col.type === "number" || col.type === "decimal") {
    return <span className="tabular-nums">{String(value)}</span>;
  }
  const s = String(value);
  return <span title={s}>{s.length > 80 ? `${s.slice(0, 80)}…` : s}</span>;
}
