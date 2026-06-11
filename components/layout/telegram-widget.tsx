"use client";

/**
 * Floating Telegram affordance, mounted globally in the locale layout.
 *
 * Two pieces:
 *   - an always-visible round button (bottom-right, above the mobile tab bar)
 *     that toggles a small popover;
 *   - the popover itself: "the project is free — send us ideas and bug
 *     reports in Telegram" with a deep link to the bot.
 *
 * For first-time visitors the popover opens once automatically after a short
 * delay (same UX contract as <InstallAppPrompt/>); dismissing it is
 * remembered in localStorage, after which the widget stays as a quiet button.
 *
 * Renders nothing when the bot URL is absent (env not configured) — the
 * server layout simply doesn't know the bot username yet.
 */

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { TelegramIcon } from "@/components/icons/telegram";

export type TelegramWidgetLabels = {
  headline: string;
  body: string;
  cta: string;
  dismiss: string;
  open_aria: string;
};

const DISMISS_KEY = "playtennis.telegramPrompt.dismissedAt";
const SHOW_DELAY_MS = 8000; // After the install prompt's 6s so they never stack on first visit.

export function TelegramWidget({
  href,
  labels,
}: {
  href: string | null;
  labels: TelegramWidgetLabels;
}) {
  const [open, setOpen] = useState(false);
  const [autoShown, setAutoShown] = useState(false);

  useEffect(() => {
    if (!href) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // localStorage blocked → skip the auto-prompt, keep the button.
      return;
    }
    const timer = window.setTimeout(() => {
      setOpen(true);
      setAutoShown(true);
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [href]);

  const rememberDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    rememberDismiss();
  }, [rememberDismiss]);

  if (!href) return null;

  return (
    <div
      className="fixed right-3 z-40 flex flex-col items-end gap-2 md:right-5"
      // Above the mobile bottom tab bar (64px) + safe area; on md+ the tab bar
      // is hidden but the same offset still looks fine, so keep it simple.
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      {open && (
        <div
          role="dialog"
          aria-live={autoShown ? "polite" : undefined}
          aria-label={labels.headline}
          className="w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-grass-200 bg-white/95 shadow-2xl ring-1 ring-grass-100 backdrop-blur-md"
        >
          <div className="flex items-start gap-3 p-3.5">
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#229ED9]/10 text-[#229ED9]"
            >
              <TelegramIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[14px] font-semibold leading-tight text-grass-900">
                {labels.headline}
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-600">
                {labels.body}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#229ED9] px-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#1d8bc0]"
                >
                  <TelegramIcon className="h-3.5 w-3.5" />
                  {labels.cta}
                </a>
                <button
                  type="button"
                  onClick={close}
                  className="ml-auto inline-flex h-8 items-center rounded-full px-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500 hover:text-ink-700"
                >
                  {labels.dismiss}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={labels.dismiss}
              className="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={labels.open_aria}
        aria-expanded={open}
        title={labels.open_aria}
        className="grid h-12 w-12 place-items-center rounded-full bg-[#229ED9] text-white shadow-[0_10px_30px_-8px_rgba(34,158,217,0.55)] transition hover:bg-[#1d8bc0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#229ED9]"
      >
        <TelegramIcon className="h-6 w-6 -translate-x-px" />
      </button>
    </div>
  );
}
