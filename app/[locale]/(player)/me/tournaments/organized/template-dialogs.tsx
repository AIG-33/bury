"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, X, Trash2, LayoutTemplate, Users2 } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { localizeActionError } from "@/lib/tournaments/action-errors";
import type { TournamentTemplatePayload } from "@/lib/tournaments/template-schema";
import type { TournamentFormat } from "@/lib/tournaments/schema";
import { saveTemplate, deleteTemplate, type TemplateRow } from "./template-actions";
import type { ClubOption } from "./actions";

const OVERLAY = "fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8";
const CARD = "shadow-pop max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6";
const INPUT =
  "h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200";
const BTN_PRIMARY =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-4 text-sm font-semibold text-white shadow-card transition hover:bg-grass-600 disabled:opacity-60";
const BTN_SECONDARY =
  "inline-flex h-10 items-center rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-50";

// ─── Save-as-template ─────────────────────────────────────────────────────────

export function SaveTemplateDialog({
  open,
  onClose,
  payload,
  defaultName,
  defaultClubId,
  clubOptions,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  payload: TournamentTemplatePayload | null;
  defaultName: string;
  defaultClubId: string | null;
  clubOptions: ClubOption[];
  onSaved: () => void;
}) {
  const t = useTranslations("tournamentsOrganized.templates");
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const [name, setName] = useState(defaultName);
  const [clubId, setClubId] = useState<string | null>(defaultClubId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setClubId(defaultClubId);
      setError(null);
    }
  }, [open, defaultName, defaultClubId]);

  if (!open || !payload) return null;

  function submit() {
    setError(null);
    startT(async () => {
      const r = await saveTemplate({ name, club_id: clubId, payload });
      if (r.ok) onSaved();
      else setError(localizeActionError(tErrors, r.error));
    });
  }

  return (
    <div className={OVERLAY}>
      <div className={CARD}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            {t("save_dialog.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-500 transition hover:bg-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-ink-600">{t("save_dialog.subtitle")}</p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">
              {t("save_dialog.name_label")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className={INPUT}
            />
          </div>

          {clubOptions.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {t("save_dialog.club_label")}
              </label>
              <select
                value={clubId ?? ""}
                onChange={(e) => setClubId(e.target.value === "" ? null : e.target.value)}
                className={INPUT}
              >
                <option value="">{t("save_dialog.club_none")}</option>
                {clubOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ink-500">{t("save_dialog.club_hint")}</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-4">
            <button type="button" onClick={onClose} className={BTN_SECONDARY}>
              {t("save_dialog.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending || name.trim().length < 2}
              className={BTN_PRIMARY}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? t("save_dialog.saving") : t("save_dialog.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Template picker ──────────────────────────────────────────────────────────

export function TemplatePickerDialog({
  open,
  onClose,
  templates,
  formatLabels,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateRow[];
  formatLabels: Record<TournamentFormat, string>;
  onPick: (template: TemplateRow) => void;
}) {
  const t = useTranslations("tournamentsOrganized.templates");
  const tErrors = useTranslations("tournamentsOrganized.errors");
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();

  if (!open) return null;

  const visible = templates.filter((tpl) => !hidden.has(tpl.id));

  function onDelete(tpl: TemplateRow) {
    if (!confirm(t("picker.delete_confirm", { name: tpl.name }))) return;
    setError(null);
    setDeletingId(tpl.id);
    startT(async () => {
      const r = await deleteTemplate(tpl.id);
      setDeletingId(null);
      if (r.ok) {
        setHidden((prev) => new Set(prev).add(tpl.id));
        router.refresh();
      } else {
        setError(localizeActionError(tErrors, r.error));
      }
    });
  }

  return (
    <div className={OVERLAY}>
      <div className={CARD}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink-900">{t("picker.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-500 transition hover:bg-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-ink-600">{t("picker.subtitle")}</p>

        {error && (
          <div className="mb-3 rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-800">
            {error}
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState title={t("picker.empty_title")} description={t("picker.empty_description")} />
        ) : (
          <ul className="space-y-2">
            {visible.map((tpl) => (
              <li
                key={tpl.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink-900">
                    <LayoutTemplate className="h-4 w-4 shrink-0 text-grass-600" />
                    {tpl.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-600">
                    {tpl.payload ? (
                      <span>{formatLabels[tpl.payload.format]}</span>
                    ) : (
                      <span className="text-clay-700">{t("picker.broken")}</span>
                    )}
                    {tpl.club_name && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-grass-50 px-2 py-0.5 text-grass-800">
                        <Users2 className="h-3 w-3" />
                        {tpl.club_name}
                      </span>
                    )}
                    {tpl.payload?.max_participants != null && (
                      <span className="tabular-nums">
                        {t("picker.max_participants", { n: tpl.payload.max_participants })}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDelete(tpl)}
                    disabled={pending && deletingId === tpl.id}
                    title={t("picker.delete")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-clay-200 text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
                  >
                    {pending && deletingId === tpl.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick(tpl)}
                    disabled={!tpl.payload}
                    className="inline-flex h-8 items-center rounded-md bg-ink-900 px-3 text-xs font-semibold text-white transition hover:bg-ink-700 disabled:opacity-40"
                  >
                    {t("picker.use")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
