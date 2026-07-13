"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

// =============================================================================
// Hero share button (tournament mockup): native share sheet when available
// (Capacitor / mobile browsers), clipboard fallback with a brief check mark.
// =============================================================================

export function TournamentShareButton({
  title,
  label,
  copiedLabel,
}: {
  title: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User dismissed the sheet — nothing to do.
        return;
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
    <button
      type="button"
      aria-label={copied ? copiedLabel : label}
      onClick={onShare}
      className="grid h-10 w-10 place-items-center rounded-[12px] border border-white/20 bg-white/15 text-white backdrop-blur-[8px] transition-opacity active:opacity-85"
    >
      {copied ? (
        <Check className="h-[18px] w-[18px]" strokeWidth={2.2} />
      ) : (
        <Share2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
      )}
    </button>
  );
}
