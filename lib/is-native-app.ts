"use client";

import { useSyncExternalStore } from "react";

/**
 * Detects the Capacitor mobile shell (App Store / Google Play wrapper around
 * the hosted site). Two independent signals:
 *
 * 1. The Capacitor bridge global — injected into the remote page by the native
 *    WebView in hosted-`server.url` mode, so it works with already-shipped
 *    store binaries. Primary check.
 * 2. The `PlayTennisApp` user-agent token (`appendUserAgent` in
 *    capacitor.config.ts) — fallback that survives even if the bridge fails to
 *    inject; requires a native rebuild to take effect.
 *
 * Client-side only: on the server it always returns `false`.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (
    window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  if (capacitor?.isNativePlatform?.()) return true;
  return navigator.userAgent.includes("PlayTennisApp");
}

// The value never changes during a page's lifetime, so no real subscription
// is needed — useSyncExternalStore just gives us a hydration-safe read.
const subscribeNoop = () => () => {};
const getServerSnapshot = () => false;

/**
 * Hook flavour for gating UI. Returns `false` during SSR/hydration (so markup
 * matches), then reflects the real value on the client without extra renders.
 */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribeNoop, isNativeApp, getServerSnapshot);
}
