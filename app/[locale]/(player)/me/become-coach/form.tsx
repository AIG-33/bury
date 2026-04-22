"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { AlertCircle, CheckCircle2, Paperclip, Send, X } from "lucide-react";
import { submitCoachApplication } from "./actions";

export type BecomeCoachCopy = {
  message_label: string;
  message_placeholder: string;
  message_hint: string;
  files_label: string;
  files_hint: string;
  files_add: string;
  files_remove: string;
  submit: string;
  submitting: string;
  submitted: string;
  error: string;
  error_message_too_short: string;
  error_too_many_files: string;
  error_file_too_large: string;
  error_bad_mime: string;
  error_pending_exists: string;
  error_already_coach: string;
  accept_attribute: string;
  max_file_bytes: number;
  max_files: number;
  allowed_mimes: string[];
};

export function BecomeCoachForm({ copy }: { copy: BecomeCoachCopy }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function pickFiles() {
    fileInputRef.current?.click();
  }

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (picked.length === 0) return;

    setError(null);
    const next = [...files];
    for (const f of picked) {
      if (next.length >= copy.max_files) {
        setError(copy.error_too_many_files);
        break;
      }
      if (f.size > copy.max_file_bytes) {
        setError(copy.error_file_too_large);
        continue;
      }
      if (!copy.allowed_mimes.includes(f.type)) {
        setError(copy.error_bad_mime);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  }

  function removeFile(idx: number) {
    setFiles(files.filter((_, i) => i !== idx));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const fd = new FormData();
    fd.set("message", message);
    for (const f of files) fd.append("files", f);

    startTransition(async () => {
      const res = await submitCoachApplication(fd);
      if (!res.ok) {
        if (res.error === "invalid_payload" && res.fieldErrors?.message) {
          setError(copy.error_message_too_short);
          return;
        }
        if (res.error === "too_many_files") {
          setError(copy.error_too_many_files);
          return;
        }
        if (res.error === "file_too_large") {
          setError(`${copy.error_file_too_large}${res.detail ? ` — ${res.detail}` : ""}`);
          return;
        }
        if (res.error === "bad_mime") {
          setError(`${copy.error_bad_mime}${res.detail ? ` — ${res.detail}` : ""}`);
          return;
        }
        if (res.error === "pending_exists") {
          setError(copy.error_pending_exists);
          return;
        }
        if (res.error === "already_coach") {
          setError(copy.error_already_coach);
          return;
        }
        setError(`${copy.error}${res.detail ? `: ${res.detail}` : ""}`);
        return;
      }
      setSuccess(true);
      setMessage("");
      setFiles([]);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl2 border border-ink-100 bg-white p-5 shadow-card"
    >
      <div className="space-y-2">
        <label
          htmlFor="coach-application-message"
          className="block font-display text-sm font-semibold text-ink-900"
        >
          {copy.message_label}
        </label>
        <textarea
          id="coach-application-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={copy.message_placeholder}
          rows={8}
          required
          className="block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-grass-500 focus:outline-none focus:ring-1 focus:ring-grass-500"
        />
        <p className="text-xs text-ink-500">{copy.message_hint}</p>
      </div>

      <div className="space-y-2">
        <label className="block font-display text-sm font-semibold text-ink-900">
          {copy.files_label}
        </label>
        <p className="text-xs text-ink-500">{copy.files_hint}</p>

        <input
          ref={fileInputRef}
          type="file"
          accept={copy.accept_attribute}
          multiple
          className="hidden"
          onChange={onFilesPicked}
        />

        <button
          type="button"
          onClick={pickFiles}
          disabled={files.length >= copy.max_files}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
        >
          <Paperclip className="h-4 w-4" />
          {copy.files_add}
        </button>

        {files.length > 0 && (
          <ul className="mt-2 space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50/40 px-3 py-2 text-sm"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                <span className="min-w-0 flex-1 truncate text-ink-800">
                  {f.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-500">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-clay-100 hover:text-clay-700"
                  aria-label={copy.files_remove}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
      {success && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-grass-50 px-3 py-2 text-sm text-grass-700">
          <CheckCircle2 className="h-4 w-4" />
          {copy.submitted}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-grass-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-grass-600 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {pending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
