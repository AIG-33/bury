"use client";

import { useState, useTransition } from "react";
import { Loader2, Send, CheckCircle2, Copy } from "lucide-react";
import { createInvitation } from "./actions";

type Copy = {
  email: string;
  first_name: string;
  last_name: string;
  cta: string;
  sending: string;
  sent: string;
  dev_link_label: string;
  error: string;
};

export function InviteForm({ copy }: { copy: Copy }) {
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<{ acceptUrl: string; mode: "resend" | "console" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await createInvitation({
        email,
        first_name: first || undefined,
        last_name: last || undefined,
      });
      if (r.ok) {
        setSuccess({ acceptUrl: r.acceptUrl, mode: r.emailMode });
        setEmail("");
        setFirst("");
        setLast("");
      } else {
        setError(`${copy.error}: ${r.error}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label={copy.email} required>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm outline-none focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
          />
        </Field>
        <Field label={copy.first_name}>
          <input
            type="text"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm outline-none focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
          />
        </Field>
        <Field label={copy.last_name}>
          <input
            type="text"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            className="h-10 w-full rounded-lg border border-ink-200 px-3 text-sm outline-none focus:border-grass-500 focus:ring-2 focus:ring-grass-500/30"
          />
        </Field>
      </div>

      {error && (
        <p className="rounded-md bg-clay-50 px-3 py-2 text-sm text-clay-700 animate-letCordShake">
          {error}
        </p>
      )}

      {success && (
        <div className="space-y-2 rounded-md border border-grass-100 bg-grass-50 p-3 text-sm text-grass-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-grass-600" />
            <span className="font-medium">{copy.sent}</span>
          </div>
          {success.mode === "console" && (
            <div className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1.5 font-mono text-[11px] text-ink-700">
              <span className="truncate">
                {copy.dev_link_label}: {success.acceptUrl}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(success.acceptUrl)}
                className="inline-flex items-center gap-1 rounded border border-ink-200 px-2 py-0.5 text-xs text-ink-700 hover:bg-ink-50"
              >
                <Copy className="h-3 w-3" /> copy
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-grass-500 px-5 text-sm font-medium text-white shadow-card transition hover:bg-grass-600 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {copy.sending}
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> {copy.cta}
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
        {label}
        {required && <span className="ml-0.5 text-clay-500">*</span>}
      </span>
      {children}
    </label>
  );
}
