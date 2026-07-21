"use client";

/**
 * "Get the app" floating prompt for mobile-web visitors.
 *
 * The native apps are live in both stores, so this replaced the old
 * install-as-PWA instruction modals: the toast now links straight to the
 * App Store / Google Play listings (see `lib/mobile/store-links.ts`).
 *
 * Shown bottom-center on small screens after a short delay; suppressed inside
 * the Capacitor shell, in an installed PWA, and for DISMISS_TTL_DAYS after
 * the user dismisses it. Localised strings come from the server layout so
 * this "use client" component needs no translation lookup of its own.
 */

import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { usePathname } from "@/i18n/routing";
import { isNativeApp } from "@/lib/is-native-app";
import { StoreBadges, type StoreBadgeLabels } from "./store-badges";

export type InstallPromptLabels = {
  /** Short headline shown in the floating toast. */
  prompt_headline: string;
  /** One-sentence body. */
  prompt_body: string;
  prompt_dismiss: string;
  badges: StoreBadgeLabels;
};

const DISMISS_KEY = "playtennis.installPrompt.dismissedAt";
const DISMISS_TTL_DAYS = 14; // Re-prompt after two weeks if user dismissed.
const SHOW_DELAY_MS = 6000; // Don't ambush: wait until the user has read something.

export function InstallAppPrompt({ labels }: { labels: InstallPromptLabels }) {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  // Onboarding is a one-shot screen sized to fit a phone viewport exactly;
  // the toast would cover its primary CTA. The user sees the prompt on the
  // very next page instead.
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  useEffect(() => {
    if (isOnboarding) return;
    // Only show on small screens — desktop users get the footer badges.
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;

    // Inside the Capacitor store app there is nothing to download.
    if (isNativeApp()) return;

    // Running as an installed PWA? The user already has an "app".
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari special case
      (window as unknown as { navigator?: { standalone?: boolean } }).navigator?.standalone ===
        true;
    if (isStandalone) return;

    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const dismissedAt = Number(raw);
        if (Number.isFinite(dismissedAt)) {
          const ageMs = Date.now() - dismissedAt;
          if (ageMs < DISMISS_TTL_DAYS * 24 * 60 * 60 * 1000) return;
        }
      }
    } catch {
      // localStorage blocked → still show, fail open.
    }

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isOnboarding]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  if (!visible || isOnboarding) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={labels.prompt_headline}
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
      // Sit just above the bottom tab bar (which is `h-[64px]` on mobile).
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-grass-200 bg-white/95 shadow-2xl ring-1 ring-grass-100 backdrop-blur-md lg:hidden">
        <div className="flex items-start gap-3 p-3.5">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-100 text-grass-700"
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-semibold leading-tight text-grass-900">
              {labels.prompt_headline}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-600">{labels.prompt_body}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StoreBadges size="sm" labels={labels.badges} />
              <button
                type="button"
                onClick={dismiss}
                className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2 font-display text-[12px] font-bold text-ink-500 hover:text-ink-700"
              >
                {labels.prompt_dismiss}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={labels.prompt_dismiss}
            className="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
