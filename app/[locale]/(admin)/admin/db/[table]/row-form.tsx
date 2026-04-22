"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listColumnsForForm,
  type ColumnDef,
  type TableDef,
} from "@/lib/admin/tables";
import { createRow, deleteRow, updateRow } from "../actions";

type Props = {
  table: TableDef;
  /** Existing row when editing; null when creating. */
  initial: Record<string, unknown> | null;
};

/** Convert a DB value into a form-input string. */
function toInputValue(col: ColumnDef, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (col.type === "boolean") return value ? "true" : "false";
  if (col.type === "json") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (col.type === "datetime") {
    try {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return "";
      // Format for <input type="datetime-local">
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  }
  if (col.type === "date") return String(value).slice(0, 10);
  return String(value);
}

export function RowForm({ table, initial }: Props) {
  const t = useTranslations("adminDb");
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => listColumnsForForm(table), [table]);
  const isEdit = initial !== null;

  const initialState = useMemo(() => {
    const s: Record<string, string | boolean> = {};
    for (const c of columns) {
      const raw = initial?.[c.key];
      if (c.type === "boolean") {
        s[c.key] = raw === true || raw === "true";
      } else {
        s[c.key] = toInputValue(c, raw);
      }
    }
    return s;
  }, [columns, initial]);

  const [values, setValues] = useState<Record<string, string | boolean>>(initialState);

  function set(key: string, v: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const col of columns) {
      if (col.readonly) continue;
      payload[col.key] = values[col.key];
    }

    if (isEdit) {
      const id = String(initial?.[table.pk] ?? "");
      const res = await updateRow(table.name, id, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      startTransition(() => router.refresh());
    } else {
      const res = await createRow(table.name, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      startTransition(() => router.push(`/${locale}/admin/db/${table.name}/${res.id}` as never));
    }
  }

  async function onDelete() {
    if (!isEdit) return;
    if (!confirm(t("confirm_delete", { table: table.label }))) return;
    const id = String(initial?.[table.pk] ?? "");
    const res = await deleteRow(table.name, id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    startTransition(() => router.push(`/${locale}/admin/db/${table.name}` as never));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="surface-card-flat border-clay-300 bg-clay-50/40 text-sm text-clay-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {columns.map((col) => (
          <Field
            key={col.key}
            col={col}
            value={values[col.key]}
            onChange={(v) => set(col.key, v)}
            fullWidth={col.type === "textarea" || col.type === "json"}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-grass-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-grass-800 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isEdit ? t("save_changes") : t("create_row")}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-clay-300 bg-white px-4 py-2 text-sm font-semibold text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {t("delete")}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  col,
  value,
  onChange,
  fullWidth,
}: {
  col: ColumnDef;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
  fullWidth?: boolean;
}) {
  const inputCls =
    "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-grass-500 focus:outline-none focus:ring-2 focus:ring-grass-200 disabled:bg-ink-50 disabled:text-ink-500";
  const wrapperCls = cn(fullWidth && "md:col-span-2");
  const disabled = !!col.readonly;

  let input: React.ReactNode = null;
  if (col.type === "boolean") {
    input = (
      <label className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={value === true || value === "true"}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-ink-300 text-grass-700 focus:ring-grass-500"
        />
        <span className="text-ink-700">{(value === true || value === "true") ? "true" : "false"}</span>
      </label>
    );
  } else if (col.type === "textarea") {
    input = (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        className={inputCls}
      />
    );
  } else if (col.type === "json") {
    input = (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={6}
        spellCheck={false}
        className={cn(inputCls, "font-mono text-[12px] leading-relaxed")}
        placeholder="{}"
      />
    );
  } else if (col.type === "select") {
    input = (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputCls}
      >
        <option value="">—</option>
        {(col.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else {
    const htmlType =
      col.type === "number" || col.type === "decimal"
        ? "number"
        : col.type === "date"
          ? "date"
          : col.type === "datetime"
            ? "datetime-local"
            : "text";
    input = (
      <input
        type={htmlType}
        step={col.type === "decimal" ? "any" : col.type === "number" ? "1" : undefined}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputCls}
      />
    );
  }

  return (
    <div className={wrapperCls}>
      <label className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-700">
        {col.label}
        {col.required && <span className="text-clay-600">*</span>}
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
          {col.type}
        </span>
      </label>
      {input}
      {col.hint && <p className="mt-1 text-[11.5px] text-ink-500">{col.hint}</p>}
    </div>
  );
}
