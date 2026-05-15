"use client";

import { Send, CheckCircle2, Copy } from "lucide-react";
import { useState } from "react";

type Props = {
  /** Already linked? Shown as a "connected" pill. */
  linked: boolean;
  /** Telegram bot username, e.g. "playtennis_by_bot". */
  botUsername: string | null;
  /** Pre-minted `https://t.me/<bot>?start=<token>` deep-link. */
  startUrl: string | null;
  copy: {
    title: string;
    body_linked: string;
    body_unlinked: string;
    cta_open_bot: string;
    cta_copy_link: string;
    cta_copied: string;
    not_configured: string;
  };
};

export function TelegramLinkCard({ linked, botUsername, startUrl, copy }: Props) {
  const [copied, setCopied] = useState(false);

  // Telegram bot wasn't configured server-side — show a passive note so the
  // user understands why the option is missing instead of seeing nothing.
  if (!botUsername || !startUrl) {
    return (
      <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-600">
            <Send className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-ink-900">{copy.title}</p>
            <p className="mt-1 text-sm text-ink-600">{copy.not_configured}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <div
          className={[
            "grid h-10 w-10 shrink-0 place-items-center rounded-full",
            linked ? "bg-grass-50 text-grass-700" : "bg-sky-50 text-sky-600",
          ].join(" ")}
        >
          {linked ? <CheckCircle2 className="h-5 w-5" /> : <Send className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-ink-900">{copy.title}</p>
          <p className="mt-1 text-sm text-ink-600">
            {linked ? copy.body_linked : copy.body_unlinked}
          </p>
          {!linked && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={startUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-grass-600 px-3 font-display text-[13px] font-semibold text-white shadow hover:bg-grass-700"
              >
                <Send className="h-3.5 w-3.5" />
                {copy.cta_open_bot}
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(startUrl).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 font-display text-[13px] font-semibold text-ink-700 hover:bg-ink-50"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? copy.cta_copied : copy.cta_copy_link}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
