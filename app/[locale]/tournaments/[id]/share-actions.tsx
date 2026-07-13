"use client";

import { useState } from "react";
import { CalendarPlus, Check, Share2 } from "lucide-react";

// =============================================================================
// «Поделиться» + «В календарь» row under the apply CTA (mockup, июль 2026).
// Share uses the native sheet when available, clipboard otherwise; calendar
// opens a prefilled Google Calendar event (works logged-out, no API key).
// =============================================================================

const BTN =
  "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-100 bg-white px-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50";

export function TournamentShareActions({
  title,
  calendarUrl,
  labels,
}: {
  title: string;
  calendarUrl: string;
  labels: { share: string; copied: string; calendar: string };
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        return; // dismissed
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={onShare} className={BTN}>
        {copied ? <Check className="h-4 w-4 text-grass-600" /> : <Share2 className="h-4 w-4" />}
        {copied ? labels.copied : labels.share}
      </button>
      <a href={calendarUrl} target="_blank" rel="noreferrer noopener" className={BTN}>
        <CalendarPlus className="h-4 w-4" />
        {labels.calendar}
      </a>
    </div>
  );
}
