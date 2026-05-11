// Tiny client-only PostHog wrapper.
//
// PostHog is opt-in (per AGENTS.md). When `NEXT_PUBLIC_POSTHOG_KEY` is unset
// every helper here is a no-op so missing env keys never crash a page or
// log anything noisy. The `init` and `track` helpers also short-circuit on
// the server (they're only meant to run in the browser) so importing this
// module from a server component is safe.

"use client";

import posthog, { type PostHog } from "posthog-js";

let initialized = false;

/**
 * Lazily initialise the PostHog client. Idempotent — safe to call from a
 * provider that mounts on every navigation. Returns `null` when the key is
 * not configured so callers can decide whether to render an opt-out UI.
 */
export function initPostHog(): PostHog | null {
  if (typeof window === "undefined") return null;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (initialized) return posthog;

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com";
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: false,
    disable_session_recording: true,
  });
  initialized = true;
  return posthog;
}

/** Send a single event. Silently no-ops if PostHog isn't initialised. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.capture(event, props);
}

/** Track a virtual pageview. Used by the provider on route changes. */
export function trackPageview(url: string): void {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: url });
}
