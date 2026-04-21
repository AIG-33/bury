"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  Sliders,
  Trash2,
} from "lucide-react";
import {
  createRatingConfig,
  activateRatingConfig,
  deleteRatingConfig,
  type RatingConfigListItem,
} from "./actions";

export function RatingListClient({
  initialConfigs,
}: {
  initialConfigs: RatingConfigListItem[];
}) {
  const t = useTranslations("adminRating");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notes, setNotes] = useState("");
  const [cloneFrom, setCloneFrom] = useState<string | "">(
    initialConfigs.find((v) => v.is_active)?.id ?? "",
  );

  function handleCreate() {
    setError(null);
    start(async () => {
      const res = await createRatingConfig({
        source_id: cloneFrom || null,
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setShowCreate(false);
      setNotes("");
      router.push(`/admin/rating/${res.id}`);
      router.refresh();
    });
  }

  function handleActivate(id: string) {
    setError(null);
    start(async () => {
      const res = await activateRatingConfig(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t("confirm_delete"))) return;
    setError(null);
    start(async () => {
      const res = await deleteRatingConfig(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-600">{t("list_subtitle")}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-clay-500 px-3 text-sm font-medium text-white shadow-card transition hover:bg-clay-600"
        >
          <Plus className="h-4 w-4" />
          {t("new_version")}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {error}
        </p>
      )}

      {initialConfigs.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white p-8 text-center">
          <Sliders className="mx-auto h-10 w-10 text-ink-400" />
          <p className="mt-2 font-display text-lg text-ink-900">{t("empty_title")}</p>
          <p className="text-sm text-ink-600">{t("empty_body")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-clay-50 text-xs uppercase tracking-wider text-clay-800">
              <tr>
                <th className="py-3 pl-4 text-left">{t("col_version")}</th>
                <th className="py-3 text-left">{t("col_status")}</th>
                <th className="py-3 text-left">{t("col_summary")}</th>
                <th className="py-3 pr-4 text-right">{t("col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {initialConfigs.map((row) => (
                <tr key={row.id} className="border-t border-ink-100">
                  <td className="py-3 pl-4 align-middle">
                    <p className="font-mono text-base font-semibold text-ink-900">
                      v{row.version}
                    </p>
                    {row.notes && (
                      <p className="line-clamp-1 max-w-xs text-xs text-ink-500">
                        {row.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 align-middle">
                    {row.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-xs font-semibold text-grass-800">
                        <CheckCircle2 className="h-3 w-3" /> {t("status_active")}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700">
                        {t("status_draft")}
                      </span>
                    )}
                  </td>
                  <td className="py-3 align-middle text-xs text-ink-600">
                    <span className="font-mono">
                      base {row.config.start_elo.base} · K p/i/e{" "}
                      {row.config.k_factors.provisional}/
                      {row.config.k_factors.intermediate}/
                      {row.config.k_factors.established}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right align-middle">
                    <div className="inline-flex items-center gap-1.5">
                      {!row.is_active && (
                        <button
                          onClick={() => handleActivate(row.id)}
                          disabled={pending}
                          className="rounded-md border border-grass-200 px-2 py-1 text-xs font-medium text-grass-700 hover:bg-grass-50 disabled:opacity-50"
                        >
                          {t("activate")}
                        </button>
                      )}
                      {!row.is_active && (
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={pending}
                          className="rounded-md border border-clay-200 px-2 py-1 text-xs font-medium text-clay-700 hover:bg-clay-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Link
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        href={`/admin/rating/${row.id}` as any}
                        className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 text-xs font-medium text-ink-800 hover:bg-ink-200"
                      >
                        {t("open")} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
          onClick={() => !pending && setShowCreate(false)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl2 bg-white p-5 shadow-ace"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h3 className="font-display text-lg font-semibold text-ink-900">
                {t("dialog_create_title")}
              </h3>
              <p className="text-sm text-ink-600">{t("dialog_create_body")}</p>
            </header>

            <label className="block text-sm">
              <span className="mb-1 block text-ink-700">{t("clone_from")}</span>
              <select
                value={cloneFrom}
                onChange={(e) => setCloneFrom(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm"
              >
                <option value="">{t("clone_default")}</option>
                {initialConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    v{c.version}
                    {c.is_active ? ` · ${t("status_active")}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {cloneFrom && (
              <p className="inline-flex items-center gap-1 text-xs text-ink-500">
                <Copy className="h-3 w-3" /> {t("clone_explainer")}
              </p>
            )}

            <label className="block text-sm">
              <span className="mb-1 block text-ink-700">{t("notes_label")}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t("notes_placeholder")}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                disabled={pending}
                className="h-9 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-clay-500 px-3 text-sm font-medium text-white shadow-card hover:bg-clay-600 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
