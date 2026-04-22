"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Paperclip,
  ThumbsDown,
  ThumbsUp,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import {
  decideCoachApplication,
  getApplicationAttachmentUrls,
  type AdminAttachmentSignedUrl,
  type AdminCoachApplicationRow,
  type LoadAdminAppsFilter,
} from "./actions";
import type { CoachApplicationStatus } from "@/lib/coach-applications/schema";

export type CoachAppsCopy = {
  filter_pending: string;
  filter_decided: string;
  filter_all: string;
  status: Record<CoachApplicationStatus, string>;
  actions: {
    approve: string;
    reject: string;
    view_files: string;
    hide_files: string;
    open_file: string;
    open_player: string;
  };
  dialog: {
    approve_title: string;
    reject_title: string;
    comment_label_optional: string;
    comment_label_required: string;
    comment_placeholder: string;
    cancel: string;
    confirm: string;
    confirming: string;
    reject_requires_comment: string;
  };
  fields: {
    submitted_at: string;
    decided_at: string;
    decided_by: string;
    attachments: string;
    message: string;
    admin_comment: string;
    already_coach: string;
  };
  error_generic: string;
  error_not_pending: string;
  files_loading: string;
};

type DialogState = {
  application_id: string;
  decision: "approved" | "rejected";
} | null;

type Props = {
  initialRows: AdminCoachApplicationRow[];
  initialFilter: LoadAdminAppsFilter;
  copy: CoachAppsCopy;
};

export function CoachApplicationsClient({
  initialRows,
  initialFilter,
  copy,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [comment, setComment] = useState("");
  const [filesByApp, setFilesByApp] = useState<
    Record<string, AdminAttachmentSignedUrl[] | "loading" | "error">
  >({});

  function changeFilter(next: LoadAdminAppsFilter) {
    const search = next === "pending" ? "" : `?filter=${next}`;
    router.replace(`${pathname}${search}` as never);
  }

  function openDialog(application_id: string, decision: "approved" | "rejected") {
    setError(null);
    setComment("");
    setDialog({ application_id, decision });
  }

  function confirmDecision() {
    if (!dialog) return;
    if (dialog.decision === "rejected" && comment.trim().length === 0) {
      setError(copy.dialog.reject_requires_comment);
      return;
    }
    setError(null);
    setBusyId(dialog.application_id);
    startTransition(async () => {
      const res = await decideCoachApplication({
        application_id: dialog.application_id,
        decision: dialog.decision,
        admin_comment: comment.trim() || null,
      });
      setBusyId(null);
      if (!res.ok) {
        setError(
          res.error === "not_pending"
            ? copy.error_not_pending
            : `${copy.error_generic}${res.detail ? `: ${res.detail}` : ""}`,
        );
        return;
      }
      setDialog(null);
      router.refresh();
    });
  }

  async function toggleFiles(application_id: string) {
    const current = filesByApp[application_id];
    if (Array.isArray(current)) {
      setFilesByApp({ ...filesByApp, [application_id]: undefined as never });
      return;
    }
    setFilesByApp({ ...filesByApp, [application_id]: "loading" });
    const res = await getApplicationAttachmentUrls(application_id);
    if (!res.ok) {
      setFilesByApp({ ...filesByApp, [application_id]: "error" });
      return;
    }
    setFilesByApp({ ...filesByApp, [application_id]: res.urls });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton
          label={copy.filter_pending}
          active={initialFilter === "pending"}
          onClick={() => changeFilter("pending")}
        />
        <FilterButton
          label={copy.filter_decided}
          active={initialFilter === "decided"}
          onClick={() => changeFilter("decided")}
        />
        <FilterButton
          label={copy.filter_all}
          active={initialFilter === "all"}
          onClick={() => changeFilter("all")}
        />
      </div>

      <ul className="space-y-3">
        {initialRows.map((r) => {
          const files = filesByApp[r.id];
          return (
            <li
              key={r.id}
              className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-grass-100 text-grass-800">
                  {r.player.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.player.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-semibold text-ink-900">
                      {r.player.display_name ?? r.player.email ?? "—"}
                    </span>
                    <StatusBadge status={r.status} label={copy.status[r.status]} />
                    {r.player.is_coach && (
                      <span className="rounded-full bg-grass-100 px-2 py-0.5 text-[11px] font-medium text-grass-800">
                        {copy.fields.already_coach}
                      </span>
                    )}
                  </div>
                  {r.player.email && (
                    <p className="text-xs text-ink-500">{r.player.email}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-500">
                    {copy.fields.submitted_at}:{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                  {r.decided_at && (
                    <p className="text-xs text-ink-500">
                      {copy.fields.decided_at}:{" "}
                      {new Date(r.decided_at).toLocaleString()}
                      {r.decided_by_name ? ` · ${copy.fields.decided_by} ${r.decided_by_name}` : ""}
                    </p>
                  )}
                </div>

                <a
                  href={`/admin/db/profiles/${r.player.id}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {copy.actions.open_player}
                </a>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-500">
                    {copy.fields.message}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-700">
                    {r.message}
                  </p>
                </div>

                {r.admin_comment && (
                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-500">
                      {copy.fields.admin_comment}
                    </p>
                    <p className="mt-1 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                      {r.admin_comment}
                    </p>
                  </div>
                )}

                {r.attachments.length > 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleFiles(r.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {Array.isArray(files)
                        ? copy.actions.hide_files
                        : copy.actions.view_files}
                      <span className="ml-1 rounded-full bg-ink-100 px-1.5 text-[10px] font-mono tabular-nums text-ink-700">
                        {r.attachments.length}
                      </span>
                    </button>
                    {files === "loading" && (
                      <p className="text-xs text-ink-500">{copy.files_loading}</p>
                    )}
                    {files === "error" && (
                      <p className="inline-flex items-center gap-1 text-xs text-clay-700">
                        <AlertCircle className="h-3 w-3" />
                        {copy.error_generic}
                      </p>
                    )}
                    {Array.isArray(files) && (
                      <ul className="space-y-1">
                        {r.attachments.map((a) => {
                          const file = files.find((u) => u.path === a.path);
                          return (
                            <li
                              key={a.path}
                              className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50/40 px-3 py-2 text-sm"
                            >
                              <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                              <span className="min-w-0 flex-1 truncate text-ink-800">
                                {a.name}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-500">
                                {(a.size / 1024).toFixed(0)} KB
                              </span>
                              {file && (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-grass-500 px-2 py-1 text-xs font-medium text-white transition hover:bg-grass-600"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {copy.actions.open_file}
                                </a>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {r.status === "pending" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={pending && busyId === r.id}
                    onClick={() => openDialog(r.id, "approved")}
                    className="inline-flex items-center gap-1 rounded-lg bg-grass-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-grass-600 disabled:opacity-60"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {copy.actions.approve}
                  </button>
                  <button
                    type="button"
                    disabled={pending && busyId === r.id}
                    onClick={() => openDialog(r.id, "rejected")}
                    className="inline-flex items-center gap-1 rounded-lg bg-clay-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    {copy.actions.reject}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {dialog && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl2 bg-white p-5 shadow-ace">
            <h3 className="font-display text-lg font-semibold text-ink-900">
              {dialog.decision === "approved"
                ? copy.dialog.approve_title
                : copy.dialog.reject_title}
            </h3>
            <label className="mt-4 block text-sm font-medium text-ink-700">
              {dialog.decision === "rejected"
                ? copy.dialog.comment_label_required
                : copy.dialog.comment_label_optional}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              placeholder={copy.dialog.comment_placeholder}
              className="mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
            />
            {error && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={pending}
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              >
                {copy.dialog.cancel}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmDecision}
                className={
                  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-60 " +
                  (dialog.decision === "approved"
                    ? "bg-grass-500 hover:bg-grass-600"
                    : "bg-clay-500 hover:bg-clay-600")
                }
              >
                {pending ? copy.dialog.confirming : copy.dialog.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-3 py-1.5 text-sm font-medium " +
        (active
          ? "bg-clay-500 text-white"
          : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50")
      }
    >
      {label}
    </button>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: CoachApplicationStatus;
  label: string;
}) {
  const cls =
    status === "approved"
      ? "bg-grass-100 text-grass-800"
      : status === "rejected"
        ? "bg-clay-100 text-clay-700"
        : "bg-ball-100 text-clay-700";
  const Icon =
    status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
        cls
      }
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
