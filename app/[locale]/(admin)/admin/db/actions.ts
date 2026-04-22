"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getTable, listColumnsForForm, type ColumnDef, type TableDef } from "@/lib/admin/tables";

// =============================================================================
// Auth gate
// =============================================================================

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "not_authenticated" as const };
  // RLS allows users to read their own profile (auth.uid() = id), so this is
  // safe even before the is_admin() recursion fix.
  const { data } = (await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()) as { data: { is_admin: boolean } | null };
  if (!data?.is_admin) return { ok: false as const, error: "not_admin" as const };
  return { ok: true as const, supabase, userId: user.id };
}

function requireValidTable(name: string): TableDef | null {
  return getTable(name);
}

// =============================================================================
// Value coercion: form inputs come in as strings; the DB needs typed values.
// We strip empty strings to NULL so non-NOT-NULL columns can be cleared.
// =============================================================================

export type FormValues = Record<string, unknown>;

function coerceValue(col: ColumnDef, raw: unknown): unknown {
  // Boolean inputs come in as "on"/"true"/"false"/true/false from FormData.
  if (col.type === "boolean") {
    if (raw === undefined || raw === null) return false;
    if (typeof raw === "boolean") return raw;
    const s = String(raw).toLowerCase();
    return s === "true" || s === "on" || s === "1" || s === "yes";
  }

  // Empty string → NULL (so users can clear optional fields).
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;

  switch (col.type) {
    case "number": {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return Math.trunc(n);
    }
    case "decimal": {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return n;
    }
    case "json": {
      if (typeof raw === "object") return raw;
      try {
        return JSON.parse(String(raw));
      } catch {
        throw new Error(`Invalid JSON in field "${col.label}"`);
      }
    }
    case "datetime": {
      // <input type="datetime-local"> returns "YYYY-MM-DDTHH:mm" w/o tz.
      // Treat it as local time and convert to ISO.
      const s = String(raw);
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    }
    case "date": {
      const s = String(raw);
      // Keep YYYY-MM-DD as a string; Supabase accepts that for `date` columns.
      return s.slice(0, 10);
    }
    default:
      return String(raw);
  }
}

function buildPayload(table: TableDef, raw: FormValues, mode: "insert" | "update"): FormValues {
  const out: FormValues = {};
  for (const col of listColumnsForForm(table)) {
    if (col.readonly) continue;
    if (mode === "update" && !(col.key in raw)) continue;
    const value = coerceValue(col, raw[col.key]);
    // Required fields must be present on insert.
    if (mode === "insert" && col.required && (value === null || value === "")) {
      throw new Error(`Field "${col.label}" is required`);
    }
    out[col.key] = value;
  }
  return out;
}

// =============================================================================
// Read: list with sort / search / filter / pagination
// =============================================================================

export type ListOptions = {
  table: string;
  page?: number;
  pageSize?: number;
  search?: string | null;
  sort?: { column: string; ascending: boolean } | null;
  filters?: Record<string, string> | null;
};

export type ListResult =
  | { ok: true; rows: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }
  | { ok: false; error: string };

export async function listRows(opts: ListOptions): Promise<ListResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const t = requireValidTable(opts.table);
  if (!t) return { ok: false, error: "unknown_table" };

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(5, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = auth.supabase.from(t.name).select("*", { count: "exact" }).range(from, to);

  // Sort
  const sort = opts.sort ?? t.defaultSort;
  if (sort?.column) {
    query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });
  }

  // Search across configured text columns: OR of ilike conditions.
  if (opts.search && opts.search.trim().length > 0 && t.searchColumns.length > 0) {
    const q = opts.search.trim().replace(/[,()]/g, " ");
    const orExpr = t.searchColumns.map((c) => `${c}.ilike.%${q}%`).join(",");
    query = query.or(orExpr);
  }

  // Filters: exact match per column.
  if (opts.filters) {
    for (const [k, v] of Object.entries(opts.filters)) {
      if (v === undefined || v === null || v === "") continue;
      const col = t.columns.find((c) => c.key === k);
      if (!col) continue;
      const coerced = (col.type === "boolean" ? coerceValue(col, v) : v) as never;
      query = query.eq(k, coerced);
    }
  }

  const { data, count, error } = await query;
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    rows: (data ?? []) as Array<Record<string, unknown>>,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getRow(
  table: string,
  id: string,
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const t = requireValidTable(table);
  if (!t) return { ok: false, error: "unknown_table" };

  const { data, error } = await auth.supabase
    .from(t.name)
    .select("*")
    .eq(t.pk, id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, row: data as Record<string, unknown> };
}

// =============================================================================
// Mutations
// =============================================================================

export async function createRow(
  table: string,
  values: FormValues,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const t = requireValidTable(table);
  if (!t) return { ok: false, error: "unknown_table" };
  if (t.disableInsert) return { ok: false, error: "insert_disabled" };

  let payload: FormValues;
  try {
    payload = buildPayload(t, values, "insert");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { data, error } = await auth.supabase
    .from(t.name)
    .insert(payload as never)
    .select(t.pk)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const id = (data as Record<string, unknown> | null)?.[t.pk];
  if (!id) return { ok: false, error: "insert_failed" };

  revalidatePath(`/admin/db/${t.name}`);
  return { ok: true, id: String(id) };
}

export async function updateRow(
  table: string,
  id: string,
  values: FormValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const t = requireValidTable(table);
  if (!t) return { ok: false, error: "unknown_table" };

  let payload: FormValues;
  try {
    payload = buildPayload(t, values, "update");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await auth.supabase
    .from(t.name)
    .update(payload as never)
    .eq(t.pk, id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/db/${t.name}`);
  revalidatePath(`/admin/db/${t.name}/${id}`);
  return { ok: true };
}

export async function deleteRow(
  table: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const t = requireValidTable(table);
  if (!t) return { ok: false, error: "unknown_table" };

  // Safety: don't let an admin delete their own profile (would lock them out).
  if (t.name === "profiles" && id === auth.userId) {
    return { ok: false, error: "cannot_delete_self" };
  }

  // Special case: deleting from `profiles` should also remove the matching
  // auth.users row (FK is profiles.id → auth.users.id ON DELETE CASCADE,
  // so removing the user wipes the profile too). Otherwise the user would
  // remain able to sign in but with no profile, which breaks the app.
  if (t.deleteAlsoAuthUser) {
    try {
      const service = createSupabaseServiceClient();
      const { error } = await service.auth.admin.deleteUser(id);
      if (error) return { ok: false, error: error.message };
      revalidatePath(`/admin/db/${t.name}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  const { error } = await auth.supabase.from(t.name).delete().eq(t.pk, id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/db/${t.name}`);
  return { ok: true };
}
