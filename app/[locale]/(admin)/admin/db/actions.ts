"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isValidConfirmationWord } from "@/lib/account/deletion";
import { performAccountDeletion } from "@/lib/account/perform-deletion";
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
    if (col.readonly || col.virtual) continue;
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
// Auth emails (profiles only)
//
// `profiles` has no email column — the full email lives in auth.users. For the
// admin DB editor we merge it into rows as a virtual read-only "email" column
// and match it on search. Fetched via the service-role client, strictly after
// the requireAdmin() gate.
// =============================================================================

async function fetchAuthEmails(): Promise<Map<string, string> | null> {
  try {
    const service = createSupabaseServiceClient();
    const emails = new Map<string, string>();
    const perPage = 1000;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("admin/db: listUsers failed", error.message);
        return null;
      }
      for (const u of data.users) {
        if (u.email) emails.set(u.id, u.email);
      }
      if (data.users.length < perPage) break;
    }
    return emails;
  } catch (e) {
    console.error("admin/db: auth emails unavailable", (e as Error).message);
    return null;
  }
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

  const authEmails = t.name === "profiles" ? await fetchAuthEmails() : null;

  let query = auth.supabase.from(t.name).select("*", { count: "exact" }).range(from, to);

  // Sort. Virtual columns don't exist in the DB — fall back to the default.
  const requestedSort = opts.sort ?? t.defaultSort;
  const sort = t.columns.find((c) => c.key === requestedSort?.column)?.virtual
    ? t.defaultSort
    : requestedSort;
  if (sort?.column) {
    query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });
  }

  // Search across configured text columns: OR of ilike conditions. Virtual
  // columns (auth email) are matched in-memory and joined via id.in.(...).
  if (opts.search && opts.search.trim().length > 0 && t.searchColumns.length > 0) {
    const q = opts.search.trim().replace(/[,()]/g, " ");
    const parts = t.searchColumns
      .filter((c) => !t.columns.find((cc) => cc.key === c)?.virtual)
      .map((c) => `${c}.ilike.%${q}%`);
    if (authEmails) {
      const ql = q.toLowerCase();
      const matchedIds: string[] = [];
      for (const [id, email] of authEmails) {
        if (email.toLowerCase().includes(ql)) {
          matchedIds.push(id);
          // Keep the PostgREST filter URL bounded.
          if (matchedIds.length >= 500) break;
        }
      }
      if (matchedIds.length > 0) parts.push(`id.in.(${matchedIds.join(",")})`);
    }
    if (parts.length > 0) query = query.or(parts.join(","));
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
  let rows = (data ?? []) as Array<Record<string, unknown>>;
  if (authEmails) {
    rows = rows.map((r) => ({ ...r, email: authEmails.get(String(r[t.pk])) ?? null }));
  }
  return {
    ok: true,
    rows,
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

  const row = data as Record<string, unknown>;
  if (t.name === "profiles") {
    try {
      const service = createSupabaseServiceClient();
      const { data: userData } = await service.auth.admin.getUserById(id);
      row.email = userData?.user?.email ?? null;
    } catch (e) {
      console.error("admin/db: auth email unavailable", (e as Error).message);
      row.email = null;
    }
  }
  return { ok: true, row };
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

  // Profiles must go through adminDeletePlayer (full deletion: personal rows,
  // storage, anonymize-or-purge, auth user). A bare row/auth delete would
  // leave a half-deleted account, so this path is closed for profiles.
  if (t.name === "profiles" || t.deleteAlsoAuthUser) {
    return { ok: false, error: "use_player_deletion" };
  }

  const { error } = await auth.supabase.from(t.name).delete().eq(t.pk, id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/db/${t.name}`);
  return { ok: true };
}

// =============================================================================
// Full player deletion (admin-initiated).
//
// Reuses the same core as self-deletion (lib/account/perform-deletion.ts):
// personal rows + storage are deleted, the profile is purged or anonymized
// («Удалённый игрок» tombstone when shared match/tournament history exists),
// and the auth.users row is destroyed. Blocked while the player owns clubs
// or live tournaments.
// =============================================================================

const AdminDeletePlayerSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.string().min(1),
});

export type AdminDeletePlayerResult =
  | { ok: true; mode: "anonymize" | "purge" }
  | {
      ok: false;
      error:
        | "invalid_payload"
        | "wrong_confirmation"
        | "not_authenticated"
        | "not_admin"
        | "cannot_delete_self"
        | "db_error";
    }
  | { ok: false; error: "blocked"; clubs: string[]; tournaments: string[] };

export async function adminDeletePlayer(input: unknown): Promise<AdminDeletePlayerResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = AdminDeletePlayerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };
  if (!isValidConfirmationWord(parsed.data.confirmation)) {
    return { ok: false, error: "wrong_confirmation" };
  }

  // Admins delete their own account via the regular profile flow (which also
  // signs the session out) — never through the admin panel.
  if (parsed.data.userId === auth.userId) {
    return { ok: false, error: "cannot_delete_self" };
  }

  const service = createSupabaseServiceClient();
  const result = await performAccountDeletion(service, parsed.data.userId);
  if (!result.ok) return result;

  revalidatePath("/admin/db/profiles");
  return result;
}
