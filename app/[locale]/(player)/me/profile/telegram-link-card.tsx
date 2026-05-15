"use client";

import { Send, CheckCircle2, Copy } from "lucide-react";
import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";

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
      <Surface variant="card" as="section">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-50 text-grass-600">
            <Send className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-ink-900">{copy.title}</p>
            <p className="mt-1 text-sm text-ink-600">{copy.not_configured}</p>
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <Surface variant="card" as="section">
      <div className="flex items-start gap-3">
        <div
          className={[
            "grid h-10 w-10 shrink-0 place-items-center rounded-full",
            linked ? "bg-grass-50 text-grass-700" : "bg-grass-100 text-grass-600",
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
              <Button asChild variant="primary" size="sm">
                <a href={startUrl} target="_blank" rel="noopener noreferrer">
                  <Send className="h-3.5 w-3.5" />
                  {copy.cta_open_bot}
                </a>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(startUrl).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? copy.cta_copied : copy.cta_copy_link}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}
