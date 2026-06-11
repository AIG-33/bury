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
import { Button } from "@/components/ui/button";
import { Surface, Chip } from "@/components/ui/surface";
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

  function handleActivate(id: string, version: number) {
    if (!confirm(t("confirm_activate", { version }))) return;
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
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" />
          {t("new_version")}
        </Button>
      </div>

      {error && (
        <Surface variant="soft" className="border border-clay-200 px-3 py-2 text-sm text-clay-800">
          {error}
        </Surface>
      )}

      {initialConfigs.length === 0 ? (
        <Surface variant="soft" className="p-8 text-center">
          <Sliders className="mx-auto h-10 w-10 text-ink-400" />
          <p className="mt-2 font-display text-lg text-ink-900">{t("empty_title")}</p>
          <p className="text-sm text-ink-600">{t("empty_body")}</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            {t("new_version")}
          </Button>
        </Surface>
      ) : (
        <div className="overflow-x-auto surface-card-flat">
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
                      <Chip tone="grass" className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {t("status_active")}
                      </Chip>
                    ) : (
                      <Chip tone="neutral">{t("status_draft")}</Chip>
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
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleActivate(row.id, row.version)}
                          disabled={pending}
                        >
                          {t("activate")}
                        </Button>
                      )}
                      {!row.is_active && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(row.id)}
                          disabled={pending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          href={`/admin/rating/${row.id}` as any}
                          className="inline-flex items-center gap-1"
                        >
                          {t("open")} <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
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
            className="surface-card w-full max-w-md space-y-4 p-5"
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreate(false)}
                disabled={pending}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                disabled={pending}
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
