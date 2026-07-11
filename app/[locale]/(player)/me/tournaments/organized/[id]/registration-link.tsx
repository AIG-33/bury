"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import type { Privacy, TournamentStatus } from "@/lib/tournaments/schema";

const noopSubscribe = () => () => {};

export type RegistrationLinkCopy = {
  title: string;
  description: string;
  copy: string;
  copied: string;
  open: string;
  hint_draft: string;
  hint_club: string;
  hint_ready: string;
  hint_closed: string;
};

export function RegistrationLink({
  path,
  status,
  privacy,
  copy,
}: {
  /** Locale-prefixed public tournament path, e.g. "/ru/tournaments/<id>". */
  path: string;
  status: TournamentStatus;
  privacy: Privacy;
  copy: RegistrationLinkCopy;
}) {
  // The absolute origin is only known in the browser; read it without a
  // hydration mismatch (server snapshot is empty, client fills it in). The
  // organizer then copies a link that works when pasted anywhere.
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}${path}`;
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (e.g. insecure context) — leave the field for a
      // manual select-and-copy; no error surface needed.
    }
  }

  const hint =
    status === "draft"
      ? copy.hint_draft
      : status !== "registration"
        ? copy.hint_closed
        : privacy === "club"
          ? copy.hint_club
          : copy.hint_ready;

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grass-50 text-grass-700">
          <Link2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-display text-sm font-semibold text-ink-900">{copy.title}</p>
            <p className="text-xs text-ink-600">{copy.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-lg border border-ink-200 bg-ink-50/40 px-3 text-xs text-ink-700 outline-none focus:border-grass-400 focus:ring-2 focus:ring-grass-200"
            />
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-grass-500 px-3 text-[12px] font-semibold text-white shadow-card transition hover:bg-grass-600"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {copy.copied}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {copy.copy}
                </>
              )}
            </button>
            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-[12px] font-medium text-ink-700 transition hover:bg-ink-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {copy.open}
            </a>
          </div>

          <p className="text-[11px] text-ink-500">{hint}</p>
        </div>
      </div>
    </section>
  );
}
