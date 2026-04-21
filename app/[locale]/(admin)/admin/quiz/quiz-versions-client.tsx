"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  Plus,
  CheckCircle2,
  Trash2,
  ArrowRight,
  Loader2,
  Copy,
  HelpCircle,
} from "lucide-react";
import {
  createQuizVersion,
  activateQuizVersion,
  deleteQuizVersion,
  type VersionListItem,
} from "./actions";

// next-intl throws on unknown keys; this helper falls back to the raw error
// code so we never crash an admin screen because of a fresh server-side string.
type TFn = ReturnType<typeof useTranslations>;
function tErr(t: TFn, code: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return t(`errors.${code}` as any);
  } catch {
    return code;
  }
}

export function QuizVersionsClient({
  initialVersions,
}: {
  initialVersions: VersionListItem[];
}) {
  const t = useTranslations("adminQuiz");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notes, setNotes] = useState("");
  const [cloneFrom, setCloneFrom] = useState<string | "">(
    initialVersions.find((v) => v.is_active)?.id ?? "",
  );

  function handleCreate() {
    setError(null);
    start(async () => {
      const res = await createQuizVersion({
        source_version_id: cloneFrom || null,
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setShowCreate(false);
      setNotes("");
      router.push(`/admin/quiz/${res.id}`);
      router.refresh();
    });
  }

  function handleActivate(id: string) {
    setError(null);
    start(async () => {
      const res = await activateQuizVersion(id);
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
      const res = await deleteQuizVersion(id);
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
          {tErr(t, error)}
        </p>
      )}

      {initialVersions.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white p-8 text-center">
          <HelpCircle className="mx-auto h-10 w-10 text-ink-400" />
          <p className="mt-2 font-display text-lg text-ink-900">{t("empty_title")}</p>
          <p className="text-sm text-ink-600">{t("empty_body")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-clay-50 text-xs uppercase tracking-wider text-clay-800">
              <tr>
                <th className="py-3 pl-4 text-left">{t("col_version")}</th>
                <th className="py-3 text-left">{t("col_status")}</th>
                <th className="py-3 text-right">{t("col_questions")}</th>
                <th className="py-3 text-right">{t("col_answers")}</th>
                <th className="py-3 pr-4 text-right">{t("col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {initialVersions.map((v) => (
                <tr key={v.id} className="border-t border-ink-100">
                  <td className="py-3 pl-4 align-middle">
                    <p className="font-mono text-base font-semibold text-ink-900">
                      v{v.version}
                    </p>
                    {v.notes && (
                      <p className="line-clamp-1 max-w-xs text-xs text-ink-500">
                        {v.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 align-middle">
                    {v.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-grass-100 px-2 py-0.5 text-xs font-semibold text-grass-800">
                        <CheckCircle2 className="h-3 w-3" /> {t("status_active")}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700">
                        {t("status_draft")}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right align-middle text-ink-700">
                    {v.question_count}
                  </td>
                  <td className="py-3 text-right align-middle text-ink-700">
                    {v.answer_count}
                  </td>
                  <td className="py-3 pr-4 text-right align-middle">
                    <div className="inline-flex items-center gap-1.5">
                      {!v.is_active && v.question_count > 0 && (
                        <button
                          onClick={() => handleActivate(v.id)}
                          disabled={pending}
                          title={t("activate")}
                          className="rounded-md border border-grass-200 px-2 py-1 text-xs font-medium text-grass-700 hover:bg-grass-50 disabled:opacity-50"
                        >
                          {t("activate")}
                        </button>
                      )}
                      {!v.is_active && v.answer_count === 0 && (
                        <button
                          onClick={() => handleDelete(v.id)}
                          disabled={pending}
                          title={t("delete")}
                          className="rounded-md border border-clay-200 px-2 py-1 text-xs font-medium text-clay-700 hover:bg-clay-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Link
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        href={`/admin/quiz/${v.id}` as any}
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
                className="h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm"
              >
                <option value="">{t("clone_none")}</option>
                {initialVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version}
                    {v.is_active ? ` · ${t("status_active")}` : ""} · {v.question_count}{" "}
                    {t("col_questions").toLowerCase()}
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
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
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
